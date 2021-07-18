function isObj(obj) {
  return typeof obj === 'object' && obj !== null
}

// const effectStack = []
let effectFn = null

const targetMap = new WeakMap()

const Vue = {
  createApp(options) {
    const renderer = Vue.createRenderer({
      querySelector(el) {
        return document.querySelector(el)
      },
      insert(parent, child, anchor = null) {
        parent.innerHTML = ''
        parent.insertBefore(child, anchor)
      }
    })
    return renderer.createApp(options)
  },
  createRenderer({ querySelector, insert }) {
    return {
      createApp(options) {
        return {
          mount(el) {
            const parent = querySelector(el)
            if (!options.render) {
                options.render = this.compile(parent.innerHTML)
            }
            if (options.setup) {
              this.setup = options.setup()
            }
            if (options.data) {
              this.data = options.data()
            }
    
            this.proxy = new Proxy(this, {
              get(target, key) {
                if (key in target.setup) {
                  return target.setup[key]
                }
                return target.data[key]
              },
              set(target, key, val) {
                if (key in target.setup) {
                  target.setup[key] = val
                  return
                }
                target.data[key] = val
              }
            })
    
            Vue.effect(() => {
              const child = options.render.call(this.proxy)
              insert(parent, child)
            })
    
          },
          compile(template) {
            return function h() {
              const h3 = document.createElement('h3')
              h3.innerHTML = this.title
              return h3
            }
          }
        }
      }
    }
  },
  reactive(obj) {
    if (!isObj(obj)) {
      return obj
    }
    return new Proxy(obj, {
      get(target, key) {
        // console.log('get:' + key);
        Vue.track(target, key)
        const val = Reflect.get(target, key)
        return isObj(val) ? reactive(val) : val
      },
      set(target, key, val) {
        // console.log('set:' + key);
        const res = Reflect.set(target, key, val)
        Vue.trigger(target, key)
        return res
      },
      deleteProperty(target, key) {
        // console.log('delete:' + key);
        return Reflect.deleteProperty(target, key)
      }
    })
  },
  effect(fn, options = []) {
    const e = Vue.createReactiveEffect(fn, options)
    e()
    return e
  },
  createReactiveEffect(fn, options) {
    // const effect = function reactiveEffect(...args) {
    //   if (!effectStack.includes(effect)) {
    //     try {
    //       effectStack.push(effect)
    //       return fn(...args)
    //     } finally {
    //       effectStack.pop()
    //     }
    //   }
    // }
    // return effect
    return function () {
      try {
        // effectStack.push(fn)
        effectFn = fn
        fn()
      } finally {
        // effectStack.pop()
      }
    }
  },
  // 建立依赖
  track(target, key) {
    // const effect = effectFn
    if (effectFn) {
      let depMap = targetMap.get(target)
      if (!depMap) {
        depMap = new Map()
        targetMap.set(target, depMap)
      }
      let deps = depMap.get(key)
      if (!deps) {
        deps = new Set()
        depMap.set(key, deps)
      }
      deps.add(effectFn)
    }
  },
  trigger(target, key) {
    const depMap = targetMap.get(target)
    if (!depMap) {
      return
    }
    const deps = depMap.get(key)
    if (deps) {
      deps.forEach(dep => dep())
    }
  }
}

const state = Vue.reactive({ foo: 'foo' })

Vue.effect(() => {
  console.log('effect1', state.foo);
})

Vue.effect(() => {
  console.log('effect2', state.foo);
})

setTimeout(() => {
  state.foo = 'fooooooo'
  console.log(state.foo);
}, 3000)