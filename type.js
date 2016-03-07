/**
 * Provides a simple API for prototype-based inheritance using familiar terms
 * implemented as chainable methods.
 *
 * @example
 * // Import module.
 * var type = require('type');
 *
 * // -------------------------------------------------------------------------
 * // Implementation
 *
 * // Constructor.
 * function S() {
 *   this.uid = S.uid++;
 * }
 *
 * // Define new type `S`. Export its constructor.
 * // S.supertype === Object
 * // S.protosupertype === Object.prototype
 * module.exports = type(S).implements({
 *   uid: {static: 0},
 *   getUid: function () {
 *     return this.uid;
 *   }
 * }).identity;
 *
 * ...
 *
 * // -------------------------------------------------------------------------
 * // Inheritance
 *
 * // Define new type `T`. Inherit properties from `S`.
 * // T.supertype === S
 * // T.protosupertype === S.prototype
 * module.exports = type(T).extends(S).identity;
 *
 * ...
 *
 * // Define new type `C`. Copy properties from mixins `A` and `B` to
 * // `C.prototype`.
 * module.exports = type(C).copies([A, B]).identity;
 *
 * ...
 *
 * // -------------------------------------------------------------------------
 * // ES3 Compatibility (Use bracket notation property access or '$' prefix.)
 *
 * module.exports = type(X).$extends(Y).$implements({
 *   uid: {static: 0},
 *   getUid: function () {
 *     return this.uid;
 *   }
 * }).identity;
 *
 * ...
 *
 * @module type
 */

(function (context) {
/*jscs:disable validateIndentation*//*jscs:enable validateIndentation*/
// -----------------------------------------------------------------------------

'use strict';

var id = 'type';
var dependencies = ['instance'];

function factory(instance) {
  /**
   * @constant {Object}
   * @private
   */
  var COPY_DEFAULTS = {key: ['prototype'], map: {}};

  /**
   * Creates an object with chainable type definition methods. Use `extends`
   * (for inheritance), `copies` (for composition via mixin), and `implements`
   * (for static and instance property definition).
   *
   * @param {function} constructor - The new type’s constructor.
   *
   * @constructor
   */
  function Type(constructor) {
    var Constructor = constructor;
    var supertype = Object;

    if (typeof Constructor !== 'function') {
      Constructor = function () {
        if (this === undefined || this.constructor !== Constructor) {
          return new Constructor();
        }
      };

      Constructor.prototype = Object(object);
      supertype = constructor.constructor;
    }

    instance.props(Constructor, {
      superprototype: {value: supertype.prototype, writable: true},
      supertype: {value: supertype, writable: true}
    });

    instance.props(this, {
      identity: {value: Constructor}
    });
  }

  instance.props(Type.prototype, {
    /**
     * Copies properties directly from one or more source `objects` to the
     * prototype of the new type being defined.
     *
     * @param {Array<(function|object)>} objects - One or more sources from
     *     which properties should be copied.
     * @param {Object}           [options]
     * @property {Array<string>} [options.key=['prototype']] - A list of
     *     property names to look up in the source `objects`; sub-properties
     *     will be copied from the first matching source object property
     *     (`prototype` by default). To copy the top-level properties of each
     *     source object, use `{key: []}`.
     * @property {Object}        [options.map] - A hash of alternative property
     *     names. A matching source object property name will be mapped to the
     *     corresponding string when it is assigned to the new type being
     *     defined; for example, `type(X).copies([{a: 1}], {map: {a: 'b'}})`
     *     will assign source object property `a` to `X.prototype` with the
     *     name `b`, which is equivalent to `X.prototype.b = 1`.
     *
     * @return {Type} A reference to this type definition object.
     */
    copies: function (objects, options) {
      var opts = options
        ? instance.defaults(options, COPY_DEFAULTS)
        : COPY_DEFAULTS;
      var prototype = this.identity.prototype;

      for (var x = 0, nx = objects.length; x < nx; ++x) {
        var object = objects[x];
        for (var i = 0, ni = opts.key ? opts.key.length : 0; i < ni; ++i) {
          var key = opts.key[i];
          if (key in object) {
            object = object[key];
            break;
          }
        }

        for (var property in object) {
          var name = opts.map[property] || property;
          prototype[name] = object[property];
        }
      }

      return this;
    },

    /**
     * Inherit properties from `supertype`.
     *
     * @param {function} supertype - The constructor of the type from which this
     *     new type inherits properties.
     *
     * @return {Type} A reference to this type definition object for chaining.
     */
    'extends': function (supertype) {
      var subtype = this.identity;
      var prototype = instance.create(supertype.prototype || supertype);

      // Overwrite any properties derived from `supertype` that are already
      // defined for `subtype` so that we can safely call `extends()` before or
      // after implementing `subtype`.
      var properties = instance.names(subtype.prototype);
      for (var x = properties.length; x--;) {
        var property = properties[x];
        var descriptor = instance.prop(subtype.prototype, property);
        instance.prop(prototype, property, descriptor);
      }

      prototype.constructor = subtype;
      subtype.prototype = prototype;

      instance.props(subtype, {
        constructor: {value: subtype, writable: false},
        superprototype: {value: supertype.prototype, writable: false},
        prototype: {value: prototype, writable: false},
        supertype: {value: supertype, writable: false}
      });

      return this;
    },

    /**
     * Defines a single property (name-value pair) of the new type.
     *
     * @param {string} name - The name of the property being defined.
     * @param {(Object|*)} descriptor - The value (possibly annotated) of the
     *     property being defined. Properties are read-only, non-enumerable, and
     *     non-configurable by default.
     *
     * @private
     */
    define: function (name, descriptor) {
      if (descriptor.hasOwnProperty('static')) {
        // Specifies a “static” property of the new type; only a single copy of
        // each such property exists and it is accessible via the type itself
        // (as opposed to an “instance” property, for which each instantiated
        // object has a separate copy).
        descriptor = instance.assign({}, descriptor);
        descriptor.value = descriptor.static;
        delete descriptor.static;

        instance.prop(this.identity, name, descriptor);
      } else {
        instance.prop(this.identity.prototype, name, descriptor);
      }
    },

    /**
     * Defines static and instance properties for the new type. Properties are
     * read-only, non-enumerable, and non-configurable unless otherwise
     * specified by a descriptor object.
     *
     * Note that `implements` herein is *not* equivalent to the Java keyword –
     * intentionally. If [duck typing](https://goo.gl/6avQva) is not your cup of
     * tea, this is probably not the inerhitance API you are looking for.
     *
     * @example
     * function Bicycle(gears) {
     *   ++numberOfBicycles;
     *   this.gears = gears;
     * }
     *
     * type(Bicycle).implements({
     *   numberOfBicycles: {static: 0},         // Static field.
     *   getNumberOfBicycles: {                 // Static method.
     *     static: function () {
     *       return Bicycle.numberOfBicycles;
     *     }
     *   },
     *
     *   getGears: function () {                // Instance method.
     *     return this.gears;
     *   }
     * });
     *
     * @param {Object} descriptors - Key-value pairs of descriptors implemented
     *     by this type.
     *
     * @return {Type} A reference to this type definition object for chaining.
     */
    'implements': function (descriptors) {
      if (arguments.length === 1) {
        for (var name in descriptors) {
          this.define(name, descriptors[name]);
        }
      } else {
        this.define(arguments[0], arguments[1]);
      }

      return this;
    },

    /** @inheritdoc */
    toString: function () {
      var name = this.identity.name || typeof this.identity;
      return '[Type' + (name ? ': ' + name : '') + ']';
    },

    /**
     * Returns the primitive value of `this`, which is the constructor function
     * of the type being defined and is exactly equal to
     * `this.{@link module:type~Type#identity|identity}`.
     *
     * @return {function} The new type’s constructor function.
     */
    valueOf: function () {
      return this.identity;
    }
  });

  instance.props(Type.prototype, {
    /**
     * ES3-compatible alias for
     * `{@link module:type~Type#extends|extends}`.
     */
    $extends: Type.prototype['extends'],

    /**
     * ES3-compatible alias for
     * `{@link module:type~Type#implements|implements}`.
     */
    $implements: Type.prototype['implements']
  });

  /**
   * Creates an object with chainable type definition methods. Use `extends`
   * (for inheritance), `copies` (for composition via mixin), and `implements`
   * (for static and instance property definition).
   *
   * @param {function} constructor - The new type’s constructor.
   *
   * @return {Type} An object with chainable type definition methods.
   *
   * @see {@link module:type~Type|Type}
   */
  return function type(constructor) {
    return new Type(constructor);
  };
}

// -----------------------------------------------------------------------------
var x = dependencies.length; var o = 'object';
context = typeof global === o ? global : typeof window === o ? window : context;
if (typeof define === 'function' && define.amd) {
  define(dependencies, function () {
    return factory.apply(context, [].slice.call(arguments));
  });
} else if (typeof module === o && module.exports) {
  for (; x--;) {dependencies[x] = require(dependencies[x]);}
  module.exports = factory.apply(context, dependencies);
} else {
  for (; x--;) {dependencies[x] = context[dependencies[x]];}
  context[id] = factory.apply(context, dependencies);
}
}(this));
