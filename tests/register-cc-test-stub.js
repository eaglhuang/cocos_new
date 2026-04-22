const Module = require('module');

class DummyComponent {}

class DummyNode {
  constructor(name = 'StubNode') {
    this.name = name;
    this.children = [];
    this.parent = null;
    this.active = true;
    this.layer = 0;
    this.scene = null;
    this._components = new Map();
    this._events = new Map();
  }

  addComponent(ComponentCtor) {
    const instance = new ComponentCtor();
    instance.node = this;
    this._components.set(ComponentCtor, instance);
    return instance;
  }

  getComponent(ComponentCtor) {
    return this._components.get(ComponentCtor) ?? null;
  }

  getChildByName(name) {
    return this.children.find((child) => child.name === name) ?? null;
  }

  getChildByPath(path) {
    const segments = String(path).split('/').filter(Boolean);
    let current = this;
    for (const segment of segments) {
      current = current?.children?.find((child) => child.name === segment) ?? null;
      if (!current) {
        return null;
      }
    }
    return current;
  }

  on(eventName, handler, target) {
    const list = this._events.get(eventName) ?? [];
    list.push({ handler, target });
    this._events.set(eventName, list);
  }

  off(eventName, handler, target) {
    const list = this._events.get(eventName) ?? [];
    this._events.set(
      eventName,
      list.filter((item) => item.handler !== handler || item.target !== target),
    );
  }

  emit(eventName, payload) {
    const list = this._events.get(eventName) ?? [];
    for (const item of list) {
      item.handler.call(item.target ?? this, payload);
    }
  }

  targetOff(target) {
    for (const [eventName, list] of this._events.entries()) {
      this._events.set(eventName, list.filter((item) => item.target !== target));
    }
  }
}

class DummyAudioSource extends DummyComponent {
  constructor() {
    super();
    this.loop = false;
    this.volume = 1;
    this.clip = null;
  }

  play() {}
  stop() {}
  pause() {}
  playOneShot() {}
}

class DummyColor {
  constructor(r = 255, g = 255, b = 255, a = 255) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

class DummyVec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toString() {
    return `(${this.x}, ${this.y}, ${this.z})`;
  }
}

DummyVec3.ZERO = new DummyVec3(0, 0, 0);

function createChainableTween() {
  return {
    to() { return this; },
    by() { return this; },
    delay() { return this; },
    call(callback) { if (typeof callback === 'function') callback(); return this; },
    union() { return this; },
    repeat() { return this; },
    start() { return this; },
    stop() { return this; },
  };
}

function createClassDecoratorPassthrough() {
  return (...args) => {
    if (args.length === 1 && typeof args[0] === 'function' && args[0].prototype instanceof DummyComponent) {
      return args[0];
    }
    return (target) => target;
  };
}

function createPropertyDecoratorPassthrough() {
  return () => (target) => target;
}

function createFactoryDecoratorPassthrough() {
  return () => (target) => target;
}

function createDummyClass(name) {
  return class {
    constructor(...args) {
      this.__name = name;
      this.__args = args;
      this.node = null;
    }
  };
}

const baseCcStub = {
  _decorator: {
    ccclass: createClassDecoratorPassthrough(),
    property: createPropertyDecoratorPassthrough(),
    executeInEditMode: createClassDecoratorPassthrough(),
    requireComponent: createFactoryDecoratorPassthrough(),
    menu: createFactoryDecoratorPassthrough(),
    help: createFactoryDecoratorPassthrough(),
    disallowMultiple: createFactoryDecoratorPassthrough(),
  },
  Node: DummyNode,
  Component: DummyComponent,
  AudioClip: class {},
  AudioSource: DummyAudioSource,
  Color: DummyColor,
  Vec3: DummyVec3,
  Vec4: class { constructor(x = 0, y = 0, z = 0, w = 0) { this.x = x; this.y = y; this.z = z; this.w = w; } },
  Rect: class { constructor(x = 0, y = 0, width = 0, height = 0) { this.x = x; this.y = y; this.width = width; this.height = height; } },
  UITransform: class extends DummyComponent {},
  Widget: class extends DummyComponent {},
  Button: class extends DummyComponent {},
  Label: class extends DummyComponent { constructor() { super(); this.string = ''; } },
  Sprite: class extends DummyComponent {},
  SpriteFrame: class {},
  Prefab: class {},
  Font: class {},
  JsonAsset: class { constructor(json = null) { this.json = json; } },
  ImageAsset: class {},
  Texture2D: class {},
  Camera: class extends DummyComponent {},
  UIOpacity: class extends DummyComponent {},
  Animation: class extends DummyComponent {},
  MeshRenderer: class extends DummyComponent {},
  ParticleSystem: class extends DummyComponent {},
  EffectAsset: class {},
  Material: class {},
  Tween: class {},
  tween: () => createChainableTween(),
  instantiate: (prefab) => prefab instanceof DummyNode ? prefab : new DummyNode('InstantiatedNode'),
  NodePool: class {
    constructor() { this._pool = []; }
    put(node) { this._pool.push(node); }
    get() { return this._pool.pop() ?? null; }
    clear() { this._pool.length = 0; }
    size() { return this._pool.length; }
  },
  assetManager: { releaseAsset() {}, loadAny(_req, cb) { cb?.(null, null); } },
  AssetManager: class {},
  Asset: class {},
  resources: {
    load(_path, _typeOrCb, cb) {
      const callback = typeof _typeOrCb === 'function' ? _typeOrCb : cb;
      callback?.(null, null);
    },
    release() {},
  },
  renderer: {},
  utils: {},
  primitives: {},
  view: {
    getVisibleSize: () => ({ width: 1920, height: 1080 }),
  },
  sys: (() => {
    const storage = new Map();
    return {
      isBrowser: false,
      platform: 'TEST',
      NetworkType: {
        NONE: 'NONE',
        LAN: 'LAN',
      },
      getNetworkType() {
        return 'LAN';
      },
      localStorage: {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); },
      },
    };
  })(),
};

const ccStub = new Proxy(baseCcStub, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }

    if (typeof prop === 'string' && /^[A-Z]/.test(prop)) {
      const dummy = createDummyClass(prop);
      target[prop] = dummy;
      return dummy;
    }

    const noop = () => undefined;
    target[prop] = noop;
    return noop;
  },
});

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'cc') {
    return ccStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};