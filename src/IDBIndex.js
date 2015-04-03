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
