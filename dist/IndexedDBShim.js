/*jshint globalstrict: true*/
'use strict';
/**
 * An initialization file that checks for conditions, removes console.log and warn, etc
 */
var idbModules = {util: {}};                // jshint ignore:line
var cleanInterface = false;                 // jshint ignore:line
(function () {
    var testObject = {test: true};
    //Test whether Object.defineProperty really works.
    if (Object.defineProperty) {
        try {
            Object.defineProperty(testObject, 'test', { enumerable: false });
            if (testObject.test) {
                cleanInterface = true;      // jshint ignore:line
            }
        } catch (e) {
        //Object.defineProperty does not work as intended.
        }
    }
})();

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {
    /**
     * A utility method to callback onsuccess, onerror, etc as soon as the calling function's context is over
     * @param {Object} fn
     * @param {Object} context
     * @param {Object} argArray
     */
    function callback(fn, context, event) {
        //window.setTimeout(function(){
        event.target = context;
        (typeof context[fn] === "function") && context[fn].apply(context, [event]);
        //}, 1);
    }

    /**
     * Shim the DOMStringList object.
     *
     */
    var StringList = function() {
        this.length = 0;
        this._items = [];
        //Internal functions on the prototype have been made non-enumerable below.
        if (cleanInterface) {
            Object.defineProperty(this, '_items', {
                enumerable: false
            });
        }
    };
    StringList.prototype = {
        // Interface.
        contains: function(str) {
            return -1 !== this._items.indexOf(str);
        },
        item: function(key) {
            return this._items[key];
        },

        // Helpers. Should only be used internally.
        indexOf: function(str) {
            return this._items.indexOf(str);
        },
        push: function(item) {
            this._items.push(item);
            this.length += 1;
            for (var i = 0; i < this._items.length; i++) {
                this[i] = this._items[i];
            }
        },
        splice: function(/*index, howmany, item1, ..., itemX*/) {
            this._items.splice.apply(this._items, arguments);
            this.length = this._items.length;
            for (var i in this) {
                if (i === String(parseInt(i, 10))) {
                    delete this[i];
                }
            }
            for (i = 0; i < this._items.length; i++) {
                this[i] = this._items[i];
            }
        }
    };
    if (cleanInterface) {
        for (var i in {
            'indexOf': false,
            'push': false,
            'splice': false
        }) {
            Object.defineProperty(StringList.prototype, i, {
                enumerable: false
            });
        }
    }

    idbModules.util.callback = callback;
    idbModules.util.StringList = StringList;
    idbModules.util.quote = function(arg) {
        return "\"" + arg + "\"";
    };

}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules){
    /**
     * Implementation of the Structured Cloning Algorithm.  Supports the
     * following object types:
     * - Blob
     * - Boolean
     * - Date object
     * - File object (deserialized as Blob object).
     * - Number object
     * - RegExp object
     * - String object
     * This is accomplished by doing the following:
     * 1) Using the cycle/decycle functions from:
     *    https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
     * 2) Serializing/deserializing objects to/from string that don't work with
     *    JSON.stringify and JSON.parse by using object specific logic (eg use 
     *    the FileReader API to convert a Blob or File object to a data URL.   
     * 3) JSON.stringify and JSON.parse do the final conversion to/from string.
     */
    var Sca = (function(){
        return {
            decycle: function(object, callback) {
                //From: https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
                // Contains additional logic to convert the following object types to string
                // so that they can properly be encoded using JSON.stringify:
                //  *Boolean
                //  *Date
                //  *File
                //  *Blob
                //  *Number
                //  *Regex
                // Make a deep copy of an object or array, assuring that there is at most
                // one instance of each object or array in the resulting structure. The
                // duplicate references (which might be forming cycles) are replaced with
                // an object of the form
                //      {$ref: PATH}
                // where the PATH is a JSONPath string that locates the first occurance.
                // So,
                //      var a = [];
                //      a[0] = a;
                //      return JSON.stringify(JSON.decycle(a));
                // produces the string '[{"$ref":"$"}]'.

                // JSONPath is used to locate the unique object. $ indicates the top level of
                // the object or array. [NUMBER] or [STRING] indicates a child member or
                // property.

                var objects = [],   // Keep a reference to each unique object or array
                paths = [],     // Keep the path to each unique object or array
                queuedObjects = [],
                returnCallback = callback;

                /**
                 * Check the queue to see if all objects have been processed.
                 * if they have, call the callback with the converted object.
                 */
                function checkForCompletion() {
                    if (queuedObjects.length === 0) {
                        returnCallback(derezObj);
                    }    
                }

                /**
                 * Convert a blob to a data URL.
                 * @param {Blob} blob to convert.
                 * @param {String} path of blob in object being encoded.
                 */
                function readBlobAsDataURL(blob, path) {
                    var reader = new FileReader();
                    reader.onloadend = function(loadedEvent) {
                        var dataURL = loadedEvent.target.result;
                        var blobtype = 'blob'; 
                        if (blob instanceof File) {
                            //blobtype = 'file';
                        }
                        updateEncodedBlob(dataURL, path, blobtype);
                    };
                    reader.readAsDataURL(blob);
                }
                
                /**
                 * Async handler to update a blob object to a data URL for encoding.
                 * @param {String} dataURL
                 * @param {String} path
                 * @param {String} blobtype - file if the blob is a file; blob otherwise
                 */
                function updateEncodedBlob(dataURL, path, blobtype) {
                    var encoded = queuedObjects.indexOf(path);
                    path = path.replace('$','derezObj');
                    eval(path+'.$enc="'+dataURL+'"');
                    eval(path+'.$type="'+blobtype+'"');
                    queuedObjects.splice(encoded, 1);
                    checkForCompletion();
                }

                function derez(value, path) {

                    // The derez recurses through the object, producing the deep copy.

                    var i,          // The loop counter
                    name,       // Property name
                    nu;         // The new object or array

                    // typeof null === 'object', so go on if this value is really an object but not
                    // one of the weird builtin objects.

                    if (typeof value === 'object' && value !== null &&
                        !(value instanceof Boolean) &&
                        !(value instanceof Date)    &&
                        !(value instanceof Number)  &&
                        !(value instanceof RegExp)  &&
                        !(value instanceof Blob)  &&
                        !(value instanceof String)) {

                        // If the value is an object or array, look to see if we have already
                        // encountered it. If so, return a $ref/path object. This is a hard way,
                        // linear search that will get slower as the number of unique objects grows.

                        for (i = 0; i < objects.length; i += 1) {
                            if (objects[i] === value) {
                                return {$ref: paths[i]};
                            }
                        }

                        // Otherwise, accumulate the unique value and its path.

                        objects.push(value);
                        paths.push(path);

                        // If it is an array, replicate the array.

                        if (Object.prototype.toString.apply(value) === '[object Array]') {
                            nu = [];
                            for (i = 0; i < value.length; i += 1) {
                                nu[i] = derez(value[i], path + '[' + i + ']');
                            }
                        } else {
                            // If it is an object, replicate the object.
                            nu = {};
                            for (name in value) {
                                if (Object.prototype.hasOwnProperty.call(value, name)) {
                                    nu[name] = derez(value[name],
                                     path + '[' + JSON.stringify(name) + ']');
                                }
                            }
                        }

                        return nu;
                    } else if (value instanceof Blob) {
                        //Queue blob for conversion
                        queuedObjects.push(path);
                        readBlobAsDataURL(value, path);
                    } else if (value instanceof Boolean) {
                        value = {
                            '$type': 'bool',
                            '$enc': value.toString()
                        };
                    } else if (value instanceof Date) {
                        value = {
                            '$type': 'date',
                            '$enc': value.getTime()
                        };
                    } else if (value instanceof Number) {
                        value = {
                            '$type': 'num',
                            '$enc': value.toString()
                        };
                    } else if (value instanceof RegExp) {
                        value = {
                            '$type': 'regex',
                            '$enc': value.toString()
                        }; 
                    }
                    return value;
                }
                var derezObj = derez(object, '$');
                checkForCompletion();
            },
                
            retrocycle: function retrocycle($) {
                //From: https://github.com/douglascrockford/JSON-js/blob/master/cycle.js
                // Contains additional logic to convert strings to the following object types 
                // so that they can properly be decoded:
                //  *Boolean
                //  *Date
                //  *File
                //  *Blob
                //  *Number
                //  *Regex
                // Restore an object that was reduced by decycle. Members whose values are
                // objects of the form
                //      {$ref: PATH}
                // are replaced with references to the value found by the PATH. This will
                // restore cycles. The object will be mutated.

                // The eval function is used to locate the values described by a PATH. The
                // root object is kept in a $ variable. A regular expression is used to
                // assure that the PATH is extremely well formed. The regexp contains nested
                // * quantifiers. That has been known to have extremely bad performance
                // problems on some browsers for very long strings. A PATH is expected to be
                // reasonably short. A PATH is allowed to belong to a very restricted subset of
                // Goessner's JSONPath.

                // So,
                //      var s = '[{"$ref":"$"}]';
                //      return JSON.retrocycle(JSON.parse(s));
                // produces an array containing a single element which is the array itself.

                var px = /^\$(?:\[(?:\d+|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
                
                /**
                 * Converts the specified data URL to a Blob object
                 * @param {String} dataURL to convert to a Blob
                 * @returns {Blob} the converted Blob object
                 */
                function dataURLToBlob(dataURL) {
                    var BASE64_MARKER = ';base64,',
                        contentType,
                        parts,
                        raw;
                    if (dataURL.indexOf(BASE64_MARKER) === -1) {
                        parts = dataURL.split(',');
                        contentType = parts[0].split(':')[1];
                        raw = parts[1];

                        return new Blob([raw], {type: contentType});
                    }

                    parts = dataURL.split(BASE64_MARKER);
                    contentType = parts[0].split(':')[1];
                    raw = window.atob(parts[1]);
                    var rawLength = raw.length;
                    var uInt8Array = new Uint8Array(rawLength);

                    for (var i = 0; i < rawLength; ++i) {
                        uInt8Array[i] = raw.charCodeAt(i);
                    }
                    return new Blob([uInt8Array.buffer], {type: contentType});
                }
                
                function rez(value) {
                    // The rez function walks recursively through the object looking for $ref
                    // properties. When it finds one that has a value that is a path, then it
                    // replaces the $ref object with a reference to the value that is found by
                    // the path.

                    var i, item, name, path;

                    if (value && typeof value === 'object') {
                        if (Object.prototype.toString.apply(value) === '[object Array]') {
                            for (i = 0; i < value.length; i += 1) {
                                item = value[i];
                                if (item && typeof item === 'object') {
                                    path = item.$ref;
                                    if (typeof path === 'string' && px.test(path)) {
                                        value[i] = eval(path);
                                    } else {
                                        value[i] = rez(item);
                                    }
                                }
                            }
                        } else {
                            if (value.$type !== undefined) {
                                switch(value.$type) {
                                    case 'blob':
                                    case 'file': 
                                        value = dataURLToBlob(value.$enc);
                                        break;
                                    case 'bool':
                                        value = Boolean(value.$enc === 'true');
                                        break;
                                    case 'date':
                                        value = new Date(value.$enc);
                                        break;
                                    case 'num':
                                        value = Number(value.$enc);
                                        break;
                                    case 'regex':
                                        value = eval(value.$enc);
                                        break;
                                }
                            } else {
                                for (name in value) {
                                    if (typeof value[name] === 'object') {
                                        item = value[name];
                                        if (item) {
                                            path = item.$ref;
                                            if (typeof path === 'string' && px.test(path)) {
                                                value[name] = eval(path);
                                            } else {
                                                value[name] = rez(item);
                                            }
                                        }
                                    }   
                                }
                            }
                        }
                    }
                    return value;
                }
                rez($);
                return $;

            },

            /**
             * Encode the specified object as a string.  Because of the asynchronus
             * conversion of Blob/File to string, the encode function requires
             * a callback
             * @param {Object} val the value to convert.
             * @param {function} callback the function to call once conversion is
             * complete.  The callback gets called with the converted value.
             */
            "encode": function(val, callback){
                function finishEncode(val) {
                    callback(JSON.stringify(val));
                }
                this.decycle(val, finishEncode);                        
            },
                    
            /**
             * Deserialize the specified string to an object
             * @param {String} val the serialized string
             * @returns {Object} the deserialized object
             */
            "decode": function(val){
                return this.retrocycle(JSON.parse(val));
            }
        };
    }());
    idbModules.Sca = Sca;
}(idbModules));
/*jshint globalstrict: true*/
'use strict';
(function(idbModules){
    /**
     * Encodes the keys and values based on their types. This is required to maintain collations
     */
    var collations = ["", "number", "string", "boolean", "object", "undefined"];
    var getGenericEncoder = function(){
        return {
            "encode": function(key){
                return collations.indexOf(typeof key) + "-" + JSON.stringify(key);
            },
            "decode": function(key){
                if (typeof key === "undefined") {
                    return undefined;
                }
                else {
                    return JSON.parse(key.substring(2));
                }
            }
        };
    };
    
    var types = {
        "number": getGenericEncoder("number"), // decoder will fail for NaN
        "boolean": getGenericEncoder(),
        "object": getGenericEncoder(),
        "string": {
            "encode": function(key){
                return collations.indexOf("string") + "-" + key;
            },
            "decode": function(key){
                return "" + key.substring(2);
            }
        },
        "undefined": {
            "encode": function(key){
                return collations.indexOf("undefined") + "-undefined";
            },
            "decode": function(key){
                return undefined;
            }
        }
    };

    /**
     * Keys must be strings, numbers, Dates, or Arrays
     */
    function validateKey(key) {
        var type = typeof key;
        if (type === "string" || type === "number" || key instanceof Date) {
            return true;
        }
        else if (key instanceof Array) {
            for (var i = 0; i < key.length; i++) {
                validateKey(key[i]);
            }
        }
        else {
            throw idbModules.util.createDOMException("DataError", "Not a valid key");
        }
    }

    /**
     * Returns the inline key value
     */
    function getKeyPath(value, keyPath) {
        try {
            return eval("value." + keyPath);
        }
        catch (e) {
            return undefined;
        }
    }

    /**
     * Sets the inline key value
     */
    function setKeyPath(value, keyPath, key) {
        var props = keyPath.split('.');
        for (var i = 0; i < props.length - 1; i++) {
            var prop = props[i];
            value = value[prop] = value[prop] || {};
        }
        value[props[props.length - 1]] = key;
    }

    idbModules.Key = {
        encode: function(key) {
            return types[typeof key].encode(key);
        },
        encodeKey: function(key) {
            validateKey(key);
            return types[typeof key].encode(key);
        },
        decode: function(key) {
            return types[collations[key.substring(0, 1)]].decode(key);
        },
        getKeyPath: getKeyPath,
        setKeyPath: setKeyPath
    };
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {
    /**
     * Creates a native Event object, for browsers that support it
     * @returns {Event}
     */
    function createNativeEvent(type, debug) {
        var event = new Event(type);
        event.debug = debug;

        // Make the "target" writable
        Object.defineProperty(event, 'target', {
            writable: true
        });

        return event;
    }

    /**
     * A shim Event class, for browsers that don't allow us to create native Event objects.
     * @constructor
     */
    function ShimEvent(type, debug) {
        this.type = type;
        this.debug = debug;
        this.bubbles = false;
        this.cancelable = false;
        this.eventPhase = 0;
        this.timeStamp = new Date().valueOf();
    }

    var useNativeEvent = false;
    try {
        // Test whether we can use the browser's native Event class
        var test = createNativeEvent('test type', 'test debug');
        var target = {test: 'test target'};
        test.target = target;

        if (test instanceof Event && test.type === 'test type' && test.debug === 'test debug' && test.target === target) {
            // Native events work as expected
            useNativeEvent = true;
        }
    }
    catch (e) {}

    if (useNativeEvent) {
        idbModules.Event = Event;
        idbModules.IDBVersionChangeEvent = Event;
        idbModules.util.createEvent = createNativeEvent;
    }
    else {
        idbModules.Event = ShimEvent;
        idbModules.IDBVersionChangeEvent = ShimEvent;
        idbModules.util.createEvent = function(type, debug) {
            return new ShimEvent(type, debug);
        };
    }
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {
    /**
     * Creates a native DOMException, for browsers that support it
     * @returns {DOMException}
     */
    function createNativeDOMException(name, message) {
        var e = new DOMException.prototype.constructor(0, message);
        e.name = name || 'DOMException';
        e.message = message;
        return e;
    }

    /**
     * Creates a native DOMError, for browsers that support it
     * @returns {DOMError}
     */
    function createNativeDOMError(name, message) {
        name = name || 'DOMError';
        var e = new DOMError(name, message);
        e.name === name || (e.name = name);
        e.message === message || (e.message = message);
        return e;
    }

    
    /**
     * Creates a generic Error object
     * @returns {Error}
     */
    function createError(name, message) {
        var e = new Error(message);
        e.name = name || 'DOMException';
        e.message = message;
        return e;
    }
    
    function logError(name, message, error) {
        if (idbModules.DEBUG) {
            if (error && error.message) {
                error = error.message;
            }
            
            var method = typeof(console.error) === 'function' ? 'error' : 'log';
            console[method](name + ': ' + message + '. ' + (error || ''));
            console.trace && console.trace();
        }
    }
    
    var test, useNativeDOMException = false, useNativeDOMError = false;

    // Test whether we can use the browser's native DOMException class
    try {
        test = createNativeDOMException('test name', 'test message');
        if (test instanceof DOMException && test.name === 'test name' && test.message === 'test message') {
            // Native DOMException works as expected
            useNativeDOMException = true;
        }
    }
    catch (e) {}
    
    // Test whether we can use the browser's native DOMError class
    try {
        test = createNativeDOMError('test name', 'test message');
        if (test instanceof DOMError && test.name === 'test name' && test.message === 'test message') {
            // Native DOMError works as expected
            useNativeDOMError = true;
        }
    }
    catch (e) {}

    idbModules.util.logError = logError;
    if (useNativeDOMException) {
        idbModules.DOMException = DOMException;
        idbModules.util.createDOMException = function(name, message, error) {
            logError(name, message, error);
            return createNativeDOMException(name, message);
        };
    }
    else {
        idbModules.DOMException = Error;
        idbModules.util.createDOMException = function(name, message, error) {
            logError(name, message, error);
            return createError(name, message);
        };
    }

    if (useNativeDOMError) {
        idbModules.DOMError = DOMError;
        idbModules.util.createDOMError = function(name, message, error) {
            logError(name, message, error);
            return createNativeDOMError(name, message);
        };
    }
    else {
        idbModules.DOMError = Error;
        idbModules.util.createDOMError = function(name, message, error) {
            logError(name, message, error);
            return createError(name, message);
        };
    }
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules){

    /**
     * The IDBRequest Object that is returns for all async calls
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#request-api
     */
    function IDBRequest(){
        this.onsuccess = this.onerror = this.result = this.error = this.source = this.transaction = null;
        this.readyState = "pending";
    }

    /**
     * The IDBOpenDBRequest called when a database is opened
     */
    function IDBOpenDBRequest(){
        this.onblocked = this.onupgradeneeded = null;
    }
    IDBOpenDBRequest.prototype = new IDBRequest();
    IDBOpenDBRequest.prototype.constructor = IDBOpenDBRequest;
    
    idbModules.IDBRequest = IDBRequest;
    idbModules.IDBOpenDBRequest = IDBOpenDBRequest;
    
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules, undefined){
    /**
     * The IndexedDB KeyRange object
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#dfn-key-range
     * @param {Object} lower
     * @param {Object} upper
     * @param {Object} lowerOpen
     * @param {Object} upperOpen
     */
    function IDBKeyRange(lower, upper, lowerOpen, upperOpen){
        this.lower = lower;
        this.upper = upper;
        this.lowerOpen = lowerOpen;
        this.upperOpen = upperOpen;
    }

    IDBKeyRange.only = function(value){
        return new IDBKeyRange(value, value, false, false);
    };

    IDBKeyRange.lowerBound = function(value, open){
        return new IDBKeyRange(value, undefined, open, undefined);
    };
    IDBKeyRange.upperBound = function(value, open){
        return new IDBKeyRange(undefined, value, undefined, open);
    };
    IDBKeyRange.bound = function(lower, upper, lowerOpen, upperOpen){
        return new IDBKeyRange(lower, upper, lowerOpen, upperOpen);
    };

    idbModules.IDBKeyRange = IDBKeyRange;

}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules, undefined){
    /**
     * The IndexedDB Cursor Object
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBCursor
     * @param {Object} range
     * @param {Object} direction
     * @param {Object} idbObjectStore
     * @param {Object} cursorRequest
     */
    function IDBCursor(range, direction, idbObjectStore, cursorRequest, keyColumnName, valueColumnName){
        if (range && !(range instanceof idbModules.IDBKeyRange)) {
            range = new idbModules.IDBKeyRange(range, range, false, false);
        }
        this.__range = range;
        this.source = this.__idbObjectStore = idbObjectStore;
        this.__req = cursorRequest;

        this.key = undefined;
        this.direction = direction;

        this.__keyColumnName = keyColumnName;
        this.__valueColumnName = valueColumnName;
        this.__valueDecoder = valueColumnName === "value" ? idbModules.Sca : idbModules.Key;

        if (!this.source.transaction.__active) {
            throw idbModules.util.createDOMException("TransactionInactiveError", "The transaction this IDBObjectStore belongs to is not active.");
        }
        // Setting this to -1 as continue will set it to 0 anyway
        this.__offset = -1;

        this.__lastKeyContinued = undefined; // Used when continuing with a key

        this["continue"]();
    }

    IDBCursor.prototype.__find = function (key, tx, success, error, recordsToLoad) {
        recordsToLoad = recordsToLoad || 1;

        var me = this;
        var sql = ["SELECT * FROM ", idbModules.util.quote(me.__idbObjectStore.name)];
        var sqlValues = [];
        sql.push("WHERE ", me.__keyColumnName, " NOT NULL");
        if (me.__range && (me.__range.lower !== undefined || me.__range.upper !== undefined )) {
            sql.push("AND");
            if (me.__range.lower !== undefined) {
                sql.push(me.__keyColumnName + (me.__range.lowerOpen ? " >" : " >= ") + " ?");
                sqlValues.push(idbModules.Key.encode(me.__range.lower));
            }
            (me.__range.lower !== undefined && me.__range.upper !== undefined) && sql.push("AND");
            if (me.__range.upper !== undefined) {
                sql.push(me.__keyColumnName + (me.__range.upperOpen ? " < " : " <= ") + " ?");
                sqlValues.push(idbModules.Key.encode(me.__range.upper));
            }
        }
        if (typeof key !== "undefined") {
            me.__lastKeyContinued = key;
            me.__offset = 0;
        }
        if (me.__lastKeyContinued !== undefined) {
            sql.push("AND " + me.__keyColumnName + " >= ?");
            sqlValues.push(idbModules.Key.encode(me.__lastKeyContinued));
        }

        // Determine the ORDER BY direction based on the cursor.
        var direction = me.direction === 'prev' || me.direction === 'prevunique' ? 'DESC' : 'ASC';

        sql.push("ORDER BY ", me.__keyColumnName, " " + direction);
        sql.push("LIMIT " + recordsToLoad + " OFFSET " + me.__offset);
        idbModules.DEBUG && console.log(sql.join(" "), sqlValues);

        me.__prefetchedData = null;
        tx.executeSql(sql.join(" "), sqlValues, function (tx, data) {

            if (data.rows.length > 1) {
                me.__prefetchedData = data.rows;
                me.__prefetchedIndex = 0;
                idbModules.DEBUG && console.log("Preloaded " + me.__prefetchedData.length + " records for cursor");
                me.__decode(data.rows.item(0), success);
            }
            else if (data.rows.length === 1) {
                me.__decode(data.rows.item(0), success);
            }
            else {
                idbModules.DEBUG && console.log("Reached end of cursors");
                success(undefined, undefined);
            }
        }, function (tx, data) {
            idbModules.DEBUG && console.log("Could not execute Cursor.continue");
            error(data);
        });
    };

    IDBCursor.prototype.__decode = function (rowItem, callback) {
        var key = idbModules.Key.decode(rowItem[this.__keyColumnName]);
        var val = this.__valueDecoder.decode(rowItem[this.__valueColumnName]);
        var primaryKey = idbModules.Key.decode(rowItem.key);
        callback(key, val, primaryKey);
    };

    IDBCursor.prototype["continue"] = function (key) {
        var recordsToPreloadOnContinue = idbModules.cursorPreloadPackSize || 100;
        var me = this;

        this.__idbObjectStore.transaction.__addToTransactionQueue(function cursorContinue(tx, args, success, error) {

            me.__offset++;

            var successCallback = function(key, val, primaryKey) {
                me.key = key;
                me.value = val;
                me.primaryKey = primaryKey;
                success(typeof me.key !== "undefined" ? me : undefined, me.__req);
            };

            if (me.__prefetchedData) {
                // We have pre-loaded data for the cursor
                me.__prefetchedIndex++;
                if (me.__prefetchedIndex < me.__prefetchedData.length) {
                    me.__decode(me.__prefetchedData.item(me.__prefetchedIndex), successCallback);
                    return;
                }
            }
            // No pre-fetched data, do query
            me.__find(key, tx, successCallback, error, recordsToPreloadOnContinue);

        });
    };

    IDBCursor.prototype.advance = function(count){
        if (count <= 0) {
            throw idbModules.util.createDOMException("Type Error", "Count is invalid - 0 or negative", count);
        }
        var me = this;
        this.__idbObjectStore.transaction.__addToTransactionQueue(function cursorAdvance(tx, args, success, error){
            me.__offset += count;
            me.__find(undefined, tx, function(key, value){
                me.key = key;
                me.value = value;
                success(typeof me.key !== "undefined" ? me : undefined, me.__req);
            }, error);
        });
    };

    IDBCursor.prototype.update = function(valueToUpdate){
        var me = this;
        me.__idbObjectStore.transaction.__assertWritable();
        var request = this.__idbObjectStore.transaction.__createRequest(function(){}); //Stub request
        idbModules.Sca.encode(valueToUpdate, function(encoded) {
            me.__idbObjectStore.transaction.__pushToQueue(request, function cursorUpdate(tx, args, success, error){
                me.__find(undefined, tx, function(key, value, primaryKey){
                    var store = me.__idbObjectStore,
                        storeProperties = me.__idbObjectStore.transaction.db.__storeProperties;
                    var params = [encoded];
                    var sql = "UPDATE " + idbModules.util.quote(store.name) + " SET value = ?";
                    var indexList = storeProperties[store.name] && storeProperties[store.name].indexList;
                    // Also correct the indexes in the table
                    if (indexList) {
                        for (var index in indexList) {
                            var indexProps = indexList[index];
                            sql += ", " + index + " = ?";
                            params.push(idbModules.Key.encode(valueToUpdate[indexProps.keyPath]));
                        }
                    }
                    sql += " WHERE key = ?";
                    params.push(idbModules.Key.encode(primaryKey));

                    idbModules.DEBUG && console.log(sql, encoded, key, primaryKey);
                    tx.executeSql(sql, params, function(tx, data){
                        me.__prefetchedData = null;
                        if (data.rowsAffected === 1) {
                            success(key);
                        }
                        else {
                            error("No rows with key found" + key);
                        }
                    }, function(tx, data){
                        error(data);
                    });
                }, error);
            });
        });
        return request;
    };

    IDBCursor.prototype["delete"] = function(){
        var me = this;
        me.__idbObjectStore.transaction.__assertWritable();
        return this.__idbObjectStore.transaction.__addToTransactionQueue(function cursorDelete(tx, args, success, error){
            me.__find(undefined, tx, function(key, value, primaryKey){
                var sql = "DELETE FROM  " + idbModules.util.quote(me.__idbObjectStore.name) + " WHERE key = ?";
                idbModules.DEBUG && console.log(sql, key, primaryKey);
                tx.executeSql(sql, [idbModules.Key.encode(primaryKey)], function(tx, data){
                    me.__prefetchedData = null;
                    if (data.rowsAffected === 1) {
                        // lower the offset or we will miss a row
                        me.__offset--;
                        success(undefined);
                    }
                    else {
                        error("No rows with key found" + key);
                    }
                }, function(tx, data){
                    error(data);
                });
            }, error);
        });
    };

    idbModules.IDBCursor = IDBCursor;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules, undefined){
    /**
     * IDB Index
     * http://www.w3.org/TR/IndexedDB/#idl-def-IDBIndex
     * @param {Object} name;
     * @param {Object} objectStore;
     */
    function IDBIndex(indexName, idbObjectStore){
        this.indexName = this.name = indexName;
        this.__idbObjectStore = this.objectStore = this.source = idbObjectStore;

        var storeProps = idbObjectStore.transaction.db.__storeProperties[idbObjectStore.name];
        var indexList = storeProps && storeProps.indexList;

        this.keyPath = ((indexList && indexList[indexName] && indexList[indexName].keyPath) || indexName);
        ['multiEntry','unique'].forEach(function(prop){
            this[prop] = !!indexList && !!indexList[indexName] && !!indexList[indexName].optionalParams && !!indexList[indexName].optionalParams[prop];
        }, this);
    }
    
    IDBIndex.prototype.__createIndex = function(indexName, keyPath, optionalParameters){
        var me = this;
        var transaction = me.__idbObjectStore.transaction;
        transaction.__addToTransactionQueue(function createIndex(tx, args, success, failure){
            me.__idbObjectStore.__getStoreProps(tx, function(){
                function error(tx, err){
                    failure(idbModules.util.createDOMException(0, "Could not create index \"" + indexName + "\"", err));
                }

                var idxList = JSON.parse(me.__idbObjectStore.__storeProps.indexList);
                if (typeof idxList[indexName] !== "undefined") {
                    failure(idbModules.util.createDOMException(0, "Index \"" + indexName + "\" already exists on store \"" + me.__idbObjectStore.name + "\"", idxList));
                }
                var columnName = indexName;
                idxList[indexName] = {
                    "columnName": columnName,
                    "keyPath": keyPath,
                    "optionalParams": optionalParameters
                };
                // For this index, first create a column
                var sql = ["ALTER TABLE", idbModules.util.quote(me.__idbObjectStore.name), "ADD", idbModules.util.quote(columnName), "BLOB"].join(" ");
                idbModules.DEBUG && console.log(sql);
                tx.executeSql(sql, [], function(tx, data){
                    // Once a column is created, put existing records into the index
                    tx.executeSql("SELECT * FROM " + idbModules.util.quote(me.__idbObjectStore.name), [], function(tx, data){
                        (function initIndexForRow(i){
                            if (i < data.rows.length) {
                                try {
                                    var value = idbModules.Sca.decode(data.rows.item(i).value);
                                    var indexKey = idbModules.Key.getKeyPath(value, keyPath);
                                    tx.executeSql("UPDATE " + idbModules.util.quote(me.__idbObjectStore.name) + " set " + idbModules.util.quote(columnName) + " = ? where key = ?", [idbModules.Key.encode(indexKey), data.rows.item(i).key], function(tx, data){
                                        initIndexForRow(i + 1);
                                    }, error);
                                } 
                                catch (e) {
                                    // Not a valid value to insert into index, so just continue
                                    initIndexForRow(i + 1);
                                }
                            }
                            else {
                                idbModules.DEBUG && console.log("Updating the indexes in table", me.__idbObjectStore.__storeProps);
                                tx.executeSql("UPDATE __sys__ set indexList = ? where name = ?", [JSON.stringify(idxList), me.__idbObjectStore.name], function(){
                                    me.__idbObjectStore.__storeProps.indexList = JSON.stringify(idxList);
                                    me.__idbObjectStore.__setReadyState("createIndex", true);
                                    success(me);
                                }, error);
                            }
                        }(0));
                    }, error);
                }, error);
            }, "createObjectStore");
        });
    };
    
    IDBIndex.prototype.openCursor = function(range, direction){
        var cursorRequest = new idbModules.IDBRequest();
        var cursor = new idbModules.IDBCursor(range, direction, this.source, cursorRequest, this.indexName, "value");
        return cursorRequest;
    };
    
    IDBIndex.prototype.openKeyCursor = function(range, direction){
        var cursorRequest = new idbModules.IDBRequest();
        var cursor = new idbModules.IDBCursor(range, direction, this.source, cursorRequest, this.indexName, "key");
        return cursorRequest;
    };
    
    IDBIndex.prototype.__fetchIndexData = function(key, opType){
        var me = this;
        var hasKey;

        // key is optional
        if (arguments.length === 1) {
            opType = key;
            key = undefined;
            hasKey = false;
        }
        else {
            key = idbModules.Key.encodeKey(key);
            hasKey = true;
        }

        return me.__idbObjectStore.transaction.__addToTransactionQueue(function fetchIndexData(tx, args, success, error){
            var sql = ["SELECT * FROM ", idbModules.util.quote(me.__idbObjectStore.name), " WHERE", idbModules.util.quote(me.indexName), "NOT NULL"];
            var sqlValues = [];
            if (hasKey) {
                sql.push("AND", idbModules.util.quote(me.indexName), " = ?");
                sqlValues.push(key);
            }
            idbModules.DEBUG && console.log("Trying to fetch data for Index", sql.join(" "), sqlValues);
            tx.executeSql(sql.join(" "), sqlValues, function(tx, data){
                var d;
                if (opType === "count") {
                    d = data.rows.length;
                }
                else 
                    if (data.rows.length === 0) {
                        d = undefined;
                    }
                    else 
                        if (opType === "key") {
                            d = idbModules.Key.decode(data.rows.item(0).key);
                        }
                        else { // when opType is value
                            d = idbModules.Sca.decode(data.rows.item(0).value);
                        }
                success(d);
            }, error);
        });
    };
    
    IDBIndex.prototype.get = function(key){
        if (arguments.length === 0) {
            throw new TypeError("No key was specified");
        }

        return this.__fetchIndexData(key, "value");
    };
    
    IDBIndex.prototype.getKey = function(key){
        if (arguments.length === 0) {
            throw new TypeError("No key was specified");
        }

        return this.__fetchIndexData(key, "key");
    };
    
    IDBIndex.prototype.count = function(key){
        // key is optional
        if (arguments.length === 0) {
            return this.__fetchIndexData("count");
        }
        else {
            return this.__fetchIndexData(key, "count");
        }
    };
    
    idbModules.IDBIndex = IDBIndex;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {

    /**
     * IndexedDB Object Store
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBObjectStore
     * @param {Object} name
     * @param {Object} transaction
     */
    function IDBObjectStore(name, idbTransaction, ready) {
        this.name = name;
        this.transaction = idbTransaction;
        this.__ready = {};
        this.__waiting = {};
        this.__setReadyState("createObjectStore", typeof ready === "undefined" ? true : ready);
        this.indexNames = new idbModules.util.StringList();
        var dbProps = idbTransaction.db.__storeProperties;
        if (dbProps[name] && dbProps[name].indexList) {
            var indexes = dbProps[name].indexList;
            for (var indexName in indexes) {
                if (indexes.hasOwnProperty(indexName)) {
                    this.indexNames.push(indexName);
                }
            }
        }
    }

    /**
     * Need this flag as createObjectStore is synchronous. So, we simply return when create ObjectStore is called
     * but do the processing in the background. All other operations should wait till ready is set
     * @param {Object} val
     */
    IDBObjectStore.prototype.__setReadyState = function(key, val) {
        this.__ready[key] = val;
        this.__runIfReady();
    };

    IDBObjectStore.prototype.__isReady = function(key) {
        if (key === "ALL") {
            for (var x in this.__ready) {
                if (!this.__ready[x]) {
                    return false;
                }
            }
            return true;
        }
        else {
            return (typeof this.__ready[key] === "undefined") ? true : this.__ready[key];
        }
    };

    /**
     * Called by all operations on the object store, waits till the store is ready, and then performs the operation
     * @param {Object} callback
     */
    IDBObjectStore.prototype.__waitForReady = function(callback, key) {
        key = key || "ALL";
        if (this.__isReady(key)) {
            callback();
        }
        else {
            this.__waiting[key] = this.__waiting[key] || [];
            this.__waiting[key].push(callback);
        }
    };

    /**
     * Performs waiting operations if the object store is ready.
     */
    IDBObjectStore.prototype.__runIfReady = function() {
        for (var key in this.__waiting) {
            if (this.__isReady(key)) {
                var waiting = this.__waiting[key];
                if (waiting && waiting.length > 0) {
                    idbModules.DEBUG && console.log(key + " is ready. Running callbacks.");
                    while (waiting.length > 0) {
                        var callback = waiting.shift();
                        callback();
                    }
                }
            }
            else {
                idbModules.DEBUG && console.log("Waiting for " + key + " to be ready");
            }
        }
    };

    /**
     * Gets (and optionally caches) the properties like keyPath, autoincrement, etc for this objectStore
     * @param {Object} callback
     */
    IDBObjectStore.prototype.__getStoreProps = function(tx, callback, waitOnProperty) {
        var me = this;
        this.__waitForReady(function() {
            if (me.__storeProps) {
                idbModules.DEBUG && console.log("Store properties - cached", me.__storeProps);
                callback(me.__storeProps);
            }
            else {
                tx.executeSql("SELECT * FROM __sys__ where name = ?", [me.name], function(tx, data) {
                    if (data.rows.length !== 1) {
                        callback();
                    }
                    else {
                        // SQLite returns 0 and 1 for bit columns where WebSQL returns stringified booleans.
                        var row = data.rows.item(0);
                        me.__storeProps = {
                            "name": row.name,
                            "indexList": row.indexList,
                            "autoInc": (typeof row.autoInc === "number" ? (row.autoInc === 1 ? "true" : "false" ) : row.autoInc),
                            "keyPath": row.keyPath
                        };
                        idbModules.DEBUG && console.log("Store properties", me.__storeProps);
                        callback(me.__storeProps);
                    }
                }, function() {
                    callback();
                });
            }
        }, waitOnProperty);
    };

    /**
     * From the store properties and object, extracts the value for the key in hte object Store
     * If the table has auto increment, get the next in sequence
     * @param {Object} props
     * @param {Object} value
     * @param {Object} key
     */
    IDBObjectStore.prototype.__deriveKey = function(tx, value, key, success, failure) {
        var me = this;

        function getNextAutoIncKey(callback) {
            tx.executeSql("SELECT * FROM sqlite_sequence where name like ?", [me.name], function(tx, data) {
                if (data.rows.length !== 1) {
                    callback(1);
                }
                else {
                    callback(data.rows.item(0).seq + 1);
                }
            }, function(tx, error) {
                failure(idbModules.util.createDOMException("Data Error", "Could not get the auto increment value for key", error));
            });
        }

        me.__getStoreProps(tx, function(props) {
            if (!props) {
                failure(idbModules.util.createDOMException("Data Error", "Could not locate defination for this table", props));
            }
            if (props.keyPath) {
                if (typeof key !== "undefined") {
                    failure(idbModules.util.createDOMException("Data Error", "The object store uses in-line keys and the key parameter was provided", props));
                }
                if (value) {
                    var primaryKey = idbModules.Key.getKeyPath(value, props.keyPath);
                    if (primaryKey === undefined) {
                        if (props.autoInc === "true") {
                            getNextAutoIncKey(function(primaryKey) {
                                try {
                                    // Update the value with the new key
                                    idbModules.Key.setKeyPath(value, props.keyPath, primaryKey);
                                    success(primaryKey);
                                }
                                catch (e) {
                                    failure(idbModules.util.createDOMException("Data Error", "Could not assign a generated value to the keyPath", e));
                                }
                            });
                        }
                        else {
                            failure(idbModules.util.createDOMException("Data Error", "Could not eval key from keyPath"));
                        }
                    }
                    else {
                        success(primaryKey);
                    }
                }
                else {
                    failure(idbModules.util.createDOMException("Data Error", "KeyPath was specified, but value was not"));
                }
            }
            else {
                if (typeof key !== "undefined") {
                    success(key);
                }
                else {
                    if (props.autoInc === "false") {
                        failure(idbModules.util.createDOMException("Data Error", "The object store uses out-of-line keys and has no key generator and the key parameter was not provided. ", props));
                    }
                    else {
                        // Looks like this has autoInc, so lets get the next in sequence and return that.
                        getNextAutoIncKey(success);
                    }
                }
            }
        });
    };

    IDBObjectStore.prototype.__insertData = function(tx, encoded, value, primaryKey, success, error) {
        var paramMap = {};
        if (typeof primaryKey !== "undefined") {
            paramMap.key = idbModules.Key.encodeKey(primaryKey);
        }
        var indexes = JSON.parse(this.__storeProps.indexList);
        for (var key in indexes) {
            try {
                paramMap[indexes[key].columnName] = idbModules.Key.encode(idbModules.Key.getKeyPath(value, indexes[key].keyPath));
            }
            catch (e) {
                error(e);
            }
        }
        var sqlStart = ["INSERT INTO ", idbModules.util.quote(this.name), "("];
        var sqlEnd = [" VALUES ("];
        var sqlValues = [];
        for (key in paramMap) {
            sqlStart.push(idbModules.util.quote(key) + ",");
            sqlEnd.push("?,");
            sqlValues.push(paramMap[key]);
        }
        // removing the trailing comma
        sqlStart.push("value )");
        sqlEnd.push("?)");
        sqlValues.push(encoded);

        var sql = sqlStart.join(" ") + sqlEnd.join(" ");

        idbModules.DEBUG && console.log("SQL for adding", sql, sqlValues);
        tx.executeSql(sql, sqlValues, function(tx, data) {
            success(primaryKey);
        }, function(tx, err) {
            error(idbModules.util.createDOMError("ConstraintError", err.message, err));
        });
    };

    IDBObjectStore.prototype.add = function(value, key) {
        var me = this;

        if (arguments.length === 0) {
            throw new TypeError("No value was specified");
        }

        me.transaction.__assertWritable();
        var request = me.transaction.__createRequest(function() {}); //Stub request
        me.transaction.__pushToQueue(request, function objectStoreAdd(tx, args, success, error) {
            me.__deriveKey(tx, value, key, function(primaryKey) {
                idbModules.Sca.encode(value, function(encoded) {
                    me.__insertData(tx, encoded, value, primaryKey, success, error);
                });
            }, error);
        });
        return request;
    };

    IDBObjectStore.prototype.put = function(value, key) {
        var me = this;

        if (arguments.length === 0) {
            throw new TypeError("No value was specified");
        }

        me.transaction.__assertWritable();
        var request = me.transaction.__createRequest(function() {}); //Stub request
        me.transaction.__pushToQueue(request, function objectStorePut(tx, args, success, error) {
            me.__deriveKey(tx, value, key, function(primaryKey) {
                idbModules.Sca.encode(value, function(encoded) {
                    // First try to delete if the record exists
                    var sql = "DELETE FROM " + idbModules.util.quote(me.name) + " where key = ?";
                    tx.executeSql(sql, [idbModules.Key.encode(primaryKey)], function(tx, data) {
                        idbModules.DEBUG && console.log("Did the row with the", primaryKey, "exist? ", data.rowsAffected);
                        me.__insertData(tx, encoded, value, primaryKey, success, error);
                    }, function(tx, err) {
                        error(err);
                    });
                });
            }, error);
        });
        return request;
    };

    IDBObjectStore.prototype.get = function(key) {
        // TODO Key should also be a key range
        var me = this;

        if (arguments.length === 0) {
            throw new TypeError("No key was specified");
        }

        var primaryKey = idbModules.Key.encodeKey(key);
        return me.transaction.__addToTransactionQueue(function objectStoreGet(tx, args, success, error) {
            me.__waitForReady(function() {
                idbModules.DEBUG && console.log("Fetching", me.name, primaryKey);
                tx.executeSql("SELECT * FROM " + idbModules.util.quote(me.name) + " where key = ?", [primaryKey], function(tx, data) {
                    idbModules.DEBUG && console.log("Fetched data", data);
                    try {
                        // Opera can't deal with the try-catch here.
                        if (0 === data.rows.length) {
                            return success();
                        }

                        success(idbModules.Sca.decode(data.rows.item(0).value));
                    }
                    catch (e) {
                        idbModules.DEBUG && console.log(e);
                        // If no result is returned, or error occurs when parsing JSON
                        success(undefined);
                    }
                }, function(tx, err) {
                    error(err);
                });
            });
        });
    };

    IDBObjectStore.prototype["delete"] = function(key) {
        var me = this;

        if (arguments.length === 0) {
            throw new TypeError("No key was specified");
        }

        me.transaction.__assertWritable();
        var primaryKey = idbModules.Key.encodeKey(key);
        // TODO key should also support key ranges
        return me.transaction.__addToTransactionQueue(function objectStoreDelete(tx, args, success, error) {
            me.__waitForReady(function() {
                idbModules.DEBUG && console.log("Fetching", me.name, primaryKey);
                tx.executeSql("DELETE FROM " + idbModules.util.quote(me.name) + " where key = ?", [primaryKey], function(tx, data) {
                    idbModules.DEBUG && console.log("Deleted from database", data.rowsAffected);
                    success();
                }, function(tx, err) {
                    error(err);
                });
            });
        });
    };

    IDBObjectStore.prototype.clear = function() {
        var me = this;
        me.transaction.__assertWritable();
        return me.transaction.__addToTransactionQueue(function objectStoreClear(tx, args, success, error) {
            me.__waitForReady(function() {
                tx.executeSql("DELETE FROM " + idbModules.util.quote(me.name), [], function(tx, data) {
                    idbModules.DEBUG && console.log("Cleared all records from database", data.rowsAffected);
                    success();
                }, function(tx, err) {
                    error(err);
                });
            });
        });
    };

    IDBObjectStore.prototype.count = function(key) {
        var me = this;
        var hasKey = false;

        // key is optional
        if (arguments.length > 0) {
            hasKey = true;
            key = idbModules.Key.encodeKey(key);
        }

        return me.transaction.__addToTransactionQueue(function objectStoreCount(tx, args, success, error) {
            me.__waitForReady(function() {
                var sql = "SELECT * FROM " + idbModules.util.quote(me.name) + (hasKey ? " WHERE key = ?" : "");
                var sqlValues = [];
                hasKey && sqlValues.push(key);
                tx.executeSql(sql, sqlValues, function(tx, data) {
                    success(data.rows.length);
                }, function(tx, err) {
                    error(err);
                });
            });
        });
    };

    IDBObjectStore.prototype.openCursor = function(range, direction) {
        var cursorRequest = new idbModules.IDBRequest();
        var cursor = new idbModules.IDBCursor(range, direction, this, cursorRequest, "key", "value");
        return cursorRequest;
    };

    IDBObjectStore.prototype.index = function(indexName) {
        if (arguments.length === 0) {
            throw new TypeError("No index name was specified");
        }

        var index = new idbModules.IDBIndex(indexName, this);
        return index;
    };

    IDBObjectStore.prototype.createIndex = function(indexName, keyPath, optionalParameters) {
        var me = this;

        if (arguments.length === 0) {
            throw new TypeError("No index name was specified");
        }
        if (arguments.length === 1) {
            throw new TypeError("No key path was specified");
        }

        me.transaction.__assertVersionChange();
        optionalParameters = optionalParameters || {};
        me.__setReadyState("createIndex", false);
        var result = new idbModules.IDBIndex(indexName, me);
        result.__createIndex(indexName, keyPath, optionalParameters);
        me.indexNames.push(indexName);

        // Also update the db indexList, because after reopening the store, we still want to know this indexName
        var storeProps = me.transaction.db.__storeProperties[me.name];
        storeProps.indexList[indexName] = {
            keyPath: keyPath,
            optionalParams: optionalParameters
        };
        return result;
    };

    IDBObjectStore.prototype.deleteIndex = function(indexName) {
        if (arguments.length === 0) {
            throw new TypeError("No index name was specified");
        }

        this.transaction.__assertVersionChange();
        var result = new idbModules.IDBIndex(indexName, this, false);
        result.__deleteIndex(indexName);
        return result;
    };

    idbModules.IDBObjectStore = IDBObjectStore;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {

    /**
     * The IndexedDB Transaction
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBTransaction
     * @param {Object} storeNames
     * @param {Object} mode
     * @param {Object} db
     */
    function IDBTransaction(storeNames, mode, db) {
        this.__active = true;
        this.__running = false;
        this.__requests = [];
        this.storeNames = storeNames;
        this.mode = mode;
        this.db = db;
        this.error = null;
        this.onabort = this.onerror = this.oncomplete = null;

        // Kick off the transaction as soon as all synchronous code is done.
        var me = this;
        setTimeout(function() { me.__executeRequests(); }, 0);
    }

    IDBTransaction.prototype.__executeRequests = function() {
        if (this.__running) {
            idbModules.DEBUG && console.log("Looks like the request set is already running", this.mode);
            return;
        }

        this.__running = true;
        var me = this;

        me.db.__db.transaction(function executeRequests(tx) {
                me.__tx = tx;
                var q = null, i = 0;

                function success(result, req) {
                    if (req) {
                        q.req = req;// Need to do this in case of cursors
                    }
                    q.req.readyState = "done";
                    q.req.result = result;
                    delete q.req.error;
                    var e = idbModules.util.createEvent("success");
                    idbModules.util.callback("onsuccess", q.req, e);
                    i++;
                    executeNextRequest();
                }

                function error(tx, err) {
                    if (arguments.length === 1) {
                        err = tx;
                    }

                    try {
                        // Fire an error event for the current IDBRequest
                        q.req.readyState = "done";
                        q.req.error = err || "DOMError";
                        var e = idbModules.util.createEvent("error", err);
                        idbModules.util.callback("onerror", q.req, e);
                    }
                    finally {
                        // Fire an error event for the transaction
                        transactionError(err);
                    }
                }

                function executeNextRequest() {
                    if (i >= me.__requests.length) {
                        // All requests in the transaction are done
                        me.__requests = [];
                        if (me.__active) {
                            me.__active = false;
                            transactionFinished();
                        }
                    }
                    else {
                        try {
                            q = me.__requests[i];
                          try {
                            q.op(tx, q.args, success, error);
                          } catch (e) {
                            if (e instanceof DOMException && e.code === 11 && tx === me.__tx) {
                              //the transaction already closed because of timing open a new transaction to run this on
                              me.db.__db.transaction(function (tx) {
                                q.op(tx, q.args, success, error);
                              });
                            } else {
                              throw e; // let other exceptions bubble up
                            }
                          }
                        }
                        catch (e) {
                            error(e);
                        }
                    }
                }

                executeNextRequest();
            },

            transactionError
        );

        function transactionError(err) {
            try {
                idbModules.util.logError("Error", "An error occurred in a transaction", err);
                me.error = err;
                var evt = idbModules.util.createEvent("error");
                idbModules.util.callback("onerror", me, evt);
            }
            finally {
                me.abort();
            }
        }

        function transactionFinished() {
            idbModules.DEBUG && console.log("Transaction completed");
            var evt = idbModules.util.createEvent("complete");
            idbModules.util.callback("oncomplete", me, evt);
            idbModules.util.callback("__oncomplete", me, evt);
        }
    };

    IDBTransaction.prototype.__addToTransactionQueue = function(callback, args) {
        var request = this.__createRequest();
        this.__pushToQueue(request, callback, args);
        return request;
    };

    IDBTransaction.prototype.__createRequest = function() {
        var request = new idbModules.IDBRequest();
        request.source = this.db;
        request.transaction = this;
        return request;
    };

    IDBTransaction.prototype.__pushToQueue = function(request, callback, args) {
        this.__assertActive();
        this.__requests.push({
            "op": callback,
            "args": args,
            "req": request
        });
    };

    IDBTransaction.prototype.__assertActive = function() {
        if (!this.__active) {
            throw idbModules.util.createDOMException("TransactionInactiveError", "A request was placed against a transaction which is currently not active, or which is finished");
        }
    };

    IDBTransaction.prototype.__assertWritable = function() {
        if (this.mode === IDBTransaction.READ_ONLY) {
            throw idbModules.util.createDOMException("ReadOnlyError", "The transaction is read only");
        }
    };

    IDBTransaction.prototype.__assertVersionChange = function() {
        IDBTransaction.__assertVersionChange(this);
    };

    IDBTransaction.__assertVersionChange = function(tx) {
        if (!tx || tx.mode !== IDBTransaction.VERSION_CHANGE) {
            throw idbModules.util.createDOMException("InvalidStateError", "Not a version transaction");
        }
    };

    IDBTransaction.prototype.objectStore = function(objectStoreName) {
        return new idbModules.IDBObjectStore(objectStoreName, this);
    };

    IDBTransaction.prototype.abort = function() {
        var me = this;
        idbModules.DEBUG && console.log("The transaction was aborted", me);
        me.__active = false;
        var evt = idbModules.util.createEvent("abort");

        // Fire the "onabort" event asynchronously, so errors don't bubble
        setTimeout(function() {
            idbModules.util.callback("onabort", me, evt);
        }, 0);
    };

    IDBTransaction.READ_ONLY = "readonly";
    IDBTransaction.READ_WRITE = "readwrite";
    IDBTransaction.VERSION_CHANGE = "versionchange";

    idbModules.IDBTransaction = IDBTransaction;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules){

    /**
     * IDB Database Object
     * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#database-interface
     * @param {Object} db
     */
    function IDBDatabase(db, name, version, storeProperties){
        this.__db = db;
        this.__closed = false;
        this.version = version;
        this.objectStoreNames = new idbModules.util.StringList();
        for (var i = 0; i < storeProperties.rows.length; i++) {
            this.objectStoreNames.push(storeProperties.rows.item(i).name);
        }
        // Convert store properties to an object because we need to modify the object when a db is upgraded and new
        // stores/indexes are being created
        this.__storeProperties = {};
        for (i = 0; i < storeProperties.rows.length; i++) {
            var row = storeProperties.rows.item(i);
            var objectStoreProps = this.__storeProperties[row.name] = {};
            objectStoreProps.keyPath = row.keypath;
            objectStoreProps.autoInc = row.autoInc === "true";
            objectStoreProps.indexList = JSON.parse(row.indexList);
        }
        this.name = name;
        this.onabort = this.onerror = this.onversionchange = null;
    }
    
    IDBDatabase.prototype.createObjectStore = function(storeName, createOptions){
        var me = this;
        createOptions = createOptions || {};
        createOptions.keyPath = createOptions.keyPath || null;
        var result = new idbModules.IDBObjectStore(storeName, me.__versionTransaction, false);
        
        var transaction = me.__versionTransaction;
        idbModules.IDBTransaction.__assertVersionChange(transaction);
        transaction.__addToTransactionQueue(function createObjectStore(tx, args, success, failure){
            function error(tx, err){
                throw idbModules.util.createDOMException(0, "Could not create object store \"" + storeName + "\"", err);
            }

            //key INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE
            var sql = ["CREATE TABLE", idbModules.util.quote(storeName), "(key BLOB", createOptions.autoIncrement ? "UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT" : "PRIMARY KEY", ", value BLOB)"].join(" ");
            idbModules.DEBUG && console.log(sql);
            tx.executeSql(sql, [], function(tx, data){
                tx.executeSql("INSERT INTO __sys__ VALUES (?,?,?,?)", [storeName, createOptions.keyPath, !!createOptions.autoIncrement, "{}"], function(){
                    result.__setReadyState("createObjectStore", true);
                    success(result);
                }, error);
            }, error);
        });
        
        // The IndexedDB Specification needs us to return an Object Store immediately, but WebSQL does not create and return the store immediately
        // Hence, this can technically be unusable, and we hack around it, by setting the ready value to false
        me.objectStoreNames.push(storeName);
        // Also store this for the first run
        var storeProps = me.__storeProperties[storeName] = {};
        storeProps.keyPath = createOptions.keyPath;
        storeProps.autoInc = !!createOptions.autoIncrement;
        storeProps.indexList = {};
        return result;
    };
    
    IDBDatabase.prototype.deleteObjectStore = function(storeName){
        var error = function(tx, err){
            throw idbModules.util.createDOMException(0, "Could not delete ObjectStore", err);
        };
        var me = this;
        !me.objectStoreNames.contains(storeName) && error(null, "Object Store does not exist");
        me.objectStoreNames.splice(me.objectStoreNames.indexOf(storeName), 1);
        
        var transaction = me.__versionTransaction;
        idbModules.IDBTransaction.__assertVersionChange(transaction);
        transaction.__addToTransactionQueue(function deleteObjectStore(tx, args, success, failure){
            me.__db.transaction(function(tx){
                tx.executeSql("SELECT * FROM __sys__ where name = ?", [storeName], function(tx, data){
                    if (data.rows.length > 0) {
                        tx.executeSql("DROP TABLE " + idbModules.util.quote(storeName), [], function(){
                            tx.executeSql("DELETE FROM __sys__ WHERE name = ?", [storeName], function(){
                                success();
                            }, error);
                        }, error);
                    }
                });
            });
        });
    };
    
    IDBDatabase.prototype.close = function(){
        this.__closed = true;
    };
    
    IDBDatabase.prototype.transaction = function(storeNames, mode){
        if (this.__closed) {
            throw idbModules.util.createDOMException("InvalidStateError", "An attempt was made to start a new transaction on a database connection that is not open");
        }

        if (typeof mode === "number") {
            mode = mode === 1 ? IDBTransaction.READ_WRITE : IDBTransaction.READ_ONLY;
            idbModules.DEBUG && console.log("Mode should be a string, but was specified as ", mode);
        }
        else {
            mode = mode || IDBTransaction.READ_ONLY;
        }

        if (mode !== IDBTransaction.READ_ONLY && mode !== IDBTransaction.READ_WRITE) {
            throw new TypeError("Invalid transaction mode: " + mode);
        }

        storeNames = typeof storeNames === "string" ? [storeNames] : storeNames;
        if (storeNames.length === 0) {
            throw idbModules.util.createDOMException("InvalidAccessError", "No object store names were specified");
        }
        for (var i = 0; i < storeNames.length; i++) {
            if (!this.objectStoreNames.contains(storeNames[i])) {
                throw idbModules.util.createDOMException("NotFoundError", "The \"" + storeNames[i] + "\" object store does not exist");
            }
        }

        var transaction = new idbModules.IDBTransaction(storeNames, mode, this);
        return transaction;
    };
    
    idbModules.IDBDatabase = IDBDatabase;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(idbModules) {
    var DEFAULT_DB_SIZE = 4 * 1024 * 1024;
    if (!window.openDatabase) {
        return;
    }
    // The sysDB to keep track of version numbers for databases
    var sysdb = window.openDatabase("__sysdb__", 1, "System Database", DEFAULT_DB_SIZE);
    sysdb.transaction(function(tx) {
        tx.executeSql("CREATE TABLE IF NOT EXISTS dbVersions (name VARCHAR(255), version INT);", []);
    }, function() {
        idbModules.DEBUG && console.log("Error in sysdb transaction - when creating dbVersions", arguments);
    });

    /**
     * IDBFactory Class
     * https://w3c.github.io/IndexedDB/#idl-def-IDBFactory
     * @constructor
     */
    function IDBFactory() {
        // It's not safe to shim these on the global scope, because it could break other stuff.
        this.Event = idbModules.Event;
        this.DOMException = idbModules.DOMException;
        this.DOMError = idbModules.DOMError;
    }

    /**
     * The IndexedDB Method to create a new database and return the DB
     * @param {Object} name
     * @param {Object} version
     */
    IDBFactory.prototype.open = function(name, version) {
        var req = new idbModules.IDBOpenDBRequest();
        var calledDbCreateError = false;

        if (arguments.length === 0) {
            throw new TypeError('Database name is required');
        }
        else if (arguments.length === 2) {
            version = parseFloat(version);
            if (isNaN(version) || !isFinite(version) || version <= 0) {
                throw new TypeError('Invalid database version: ' + version);
            }
        }
        name = name + ''; // cast to a string

        function dbCreateError(err) {
            if (calledDbCreateError) {
                return;
            }
            calledDbCreateError = true;
            var evt = idbModules.util.createEvent("error", arguments);
            req.readyState = "done";
            req.error = err || "DOMError";
            idbModules.util.callback("onerror", req, evt);
        }

        function openDB(oldVersion) {
            var db = window.openDatabase(name, 1, name, DEFAULT_DB_SIZE);
            req.readyState = "done";
            if (typeof version === "undefined") {
                version = oldVersion || 1;
            }
            if (version <= 0 || oldVersion > version) {
                var err = idbModules.util.createDOMError("VersionError", "An attempt was made to open a database using a lower version than the existing version.", version);
                dbCreateError(err);
                return;
            }

            db.transaction(function(tx) {
                tx.executeSql("CREATE TABLE IF NOT EXISTS __sys__ (name VARCHAR(255), keyPath VARCHAR(255), autoInc BOOLEAN, indexList BLOB)", [], function() {
                    tx.executeSql("SELECT * FROM __sys__", [], function(tx, data) {
                        var e = idbModules.util.createEvent("success");
                        req.source = req.result = new idbModules.IDBDatabase(db, name, version, data);
                        if (oldVersion < version) {
                            // DB Upgrade in progress
                            sysdb.transaction(function(systx) {
                                systx.executeSql("UPDATE dbVersions set version = ? where name = ?", [version, name], function() {
                                    var e = idbModules.util.createEvent("upgradeneeded");
                                    e.oldVersion = oldVersion;
                                    e.newVersion = version;
                                    req.transaction = req.result.__versionTransaction = new idbModules.IDBTransaction([], idbModules.IDBTransaction.VERSION_CHANGE, req.source);
                                    req.transaction.__addToTransactionQueue(function onupgradeneeded(tx, args, success) {
                                        idbModules.util.callback("onupgradeneeded", req, e);
                                        success();
                                    });
                                    req.transaction.__oncomplete = function() {
                                        req.transaction = null;
                                        var e = idbModules.util.createEvent("success");
                                        idbModules.util.callback("onsuccess", req, e);
                                    };
                                }, dbCreateError);
                            }, dbCreateError);
                        } else {
                            idbModules.util.callback("onsuccess", req, e);
                        }
                    }, dbCreateError);
                }, dbCreateError);
            }, dbCreateError);
        }

        sysdb.transaction(function(tx) {
            tx.executeSql("SELECT * FROM dbVersions where name = ?", [name], function(tx, data) {
                if (data.rows.length === 0) {
                    // Database with this name does not exist
                    tx.executeSql("INSERT INTO dbVersions VALUES (?,?)", [name, version || 1], function() {
                        openDB(0);
                    }, dbCreateError);
                } else {
                    openDB(data.rows.item(0).version);
                }
            }, dbCreateError);
        }, dbCreateError);

        return req;
    };

    IDBFactory.prototype.deleteDatabase = function(name) {
        var req = new idbModules.IDBOpenDBRequest();
        var calledDBError = false;
        var version = null;

        if (arguments.length === 0) {
            throw new TypeError('Database name is required');
        }
        name = name + ''; // cast to a string

        function dbError(msg) {
            if (calledDBError) {
                return;
            }
            req.readyState = "done";
            req.error = "DOMError";
            var e = idbModules.util.createEvent("error");
            e.message = msg;
            e.debug = arguments;
            idbModules.util.callback("onerror", req, e);
            calledDBError = true;
        }

        function deleteFromDbVersions() {
            sysdb.transaction(function(systx) {
                systx.executeSql("DELETE FROM dbVersions where name = ? ", [name], function() {
                    req.result = undefined;
                    var e = idbModules.util.createEvent("success");
                    e.newVersion = null;
                    e.oldVersion = version;
                    idbModules.util.callback("onsuccess", req, e);
                }, dbError);
            }, dbError);
        }

        sysdb.transaction(function(systx) {
            systx.executeSql("SELECT * FROM dbVersions where name = ?", [name], function(tx, data) {
                if (data.rows.length === 0) {
                    req.result = undefined;
                    var e = idbModules.util.createEvent("success");
                    e.newVersion = null;
                    e.oldVersion = version;
                    idbModules.util.callback("onsuccess", req, e);
                    return;
                }
                version = data.rows.item(0).version;
                var db = window.openDatabase(name, 1, name, DEFAULT_DB_SIZE);
                db.transaction(function(tx) {
                    tx.executeSql("SELECT * FROM __sys__", [], function(tx, data) {
                        var tables = data.rows;
                        (function deleteTables(i) {
                            if (i >= tables.length) {
                                // If all tables are deleted, delete the housekeeping tables
                                tx.executeSql("DROP TABLE __sys__", [], function() {
                                    // Finally, delete the record for this DB from sysdb
                                    deleteFromDbVersions();
                                }, dbError);
                            } else {
                                // Delete all tables in this database, maintained in the sys table
                                tx.executeSql("DROP TABLE " + idbModules.util.quote(tables.item(i).name), [], function() {
                                    deleteTables(i + 1);
                                }, function() {
                                    deleteTables(i + 1);
                                });
                            }
                        }(0));
                    }, function(e) {
                        // __sysdb table does not exist, but that does not mean delete did not happen
                        deleteFromDbVersions();
                    });
                }, dbError);
            });
        }, dbError);
        return req;
    };

    IDBFactory.prototype.cmp = function(key1, key2) {
        return idbModules.Key.encodeKey(key1) > idbModules.Key.encodeKey(key2) ? 1 : key1 === key2 ? 0 : -1;
    };


    idbModules.shimIndexedDB = new IDBFactory();
    idbModules.IDBFactory = IDBFactory;
}(idbModules));

/*jshint globalstrict: true*/
'use strict';
(function(window, idbModules){
    function shim(name, value) {
        try {
            // Try setting the property. This will fail if the property is read-only.
            window[name] = value;
        }
        catch (e) {}

        if (window[name] !== value && Object.defineProperty) {
            // Setting a read-only property failed, so try re-defining the property
            try {
                Object.defineProperty(window, name, {
                    value: value
                });
            }
            catch (e) {}

            if (window[name] !== value) {
                window.console && console.warn && console.warn('Unable to shim ' + name);
            }
        }
    }

    if (typeof window.openDatabase !== "undefined") {
        shim('shimIndexedDB', idbModules.shimIndexedDB);
        if (window.shimIndexedDB) {
            window.shimIndexedDB.__useShim = function(){
                shim('indexedDB', idbModules.shimIndexedDB);
                shim('IDBFactory', idbModules.IDBFactory);
                shim('IDBDatabase', idbModules.IDBDatabase);
                shim('IDBObjectStore', idbModules.IDBObjectStore);
                shim('IDBIndex', idbModules.IDBIndex);
                shim('IDBTransaction', idbModules.IDBTransaction);
                shim('IDBCursor', idbModules.IDBCursor);
                shim('IDBKeyRange', idbModules.IDBKeyRange);
                shim('IDBRequest', idbModules.IDBRequest);
                shim('IDBOpenDBRequest', idbModules.IDBOpenDBRequest);
                shim('IDBVersionChangeEvent', idbModules.IDBVersionChangeEvent);
            };

            window.shimIndexedDB.__debug = function(val){
                idbModules.DEBUG = val;
            };
        }
    }
    
    /*
    prevent error in Firefox
    */
    if(!('indexedDB' in window)) {
        window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.oIndexedDB || window.msIndexedDB;
    }
    
    /*
    detect browsers with known IndexedDb issues (e.g. Android pre-4.4)
    */
    var poorIndexedDbSupport = false;
    if (navigator.userAgent.match(/Android 2/) || navigator.userAgent.match(/Android 3/) || navigator.userAgent.match(/Android 4\.[0-3]/)) {
        /* Chrome is an exception. It supports IndexedDb */
        if (!navigator.userAgent.match(/Chrome/)) {
            poorIndexedDbSupport = true;
        }
    }

    if ((typeof window.indexedDB === "undefined" || !window.indexedDB || poorIndexedDbSupport) && typeof window.openDatabase !== "undefined") {
        window.shimIndexedDB.__useShim();
    }
    else {
        window.IDBDatabase = window.IDBDatabase || window.webkitIDBDatabase;
        window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
        window.IDBCursor = window.IDBCursor || window.webkitIDBCursor;
        window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
        if(!window.IDBTransaction){
            window.IDBTransaction = {};
        }
        /* Some browsers (e.g. Chrome 18 on Android) support IndexedDb but do not allow writing of these properties */
        try {
            window.IDBTransaction.READ_ONLY = window.IDBTransaction.READ_ONLY || "readonly";
            window.IDBTransaction.READ_WRITE = window.IDBTransaction.READ_WRITE || "readwrite";
        } catch (e) {}
    }
    
}(window, idbModules));

