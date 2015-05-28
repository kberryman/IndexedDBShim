queuedModule("Indexes");
queuedAsyncTest("Creating Indexes", function(){
    var dbOpenRequest = xc_indexedDB.open(DB.NAME, ++dbVersion);
    dbOpenRequest.onsuccess = function(e){
        ok(true, "Database Opened successfully");
        _("Database opened successfully with version");
        dbOpenRequest.result.close();
        nextTest();
        start();
    };
    dbOpenRequest.onerror = function(e){
        ok(false, "Database NOT Opened successfully");
        _("Database NOT opened successfully");
        nextTest();
        start();
    };
    dbOpenRequest.onupgradeneeded = function(e){
        ok(true, "Database Upgraded successfully");
        _("Database upgrade called");
        var db = dbOpenRequest.result;
        var objectStore1 = dbOpenRequest.transaction.objectStore(DB.OBJECT_STORE_1);
        var index1 = objectStore1.createIndex("Int Index", "Int", {
            "unique": false,
            "multiEntry": false
        });
        var index2 = objectStore1.createIndex("String.Index", "String");
        equal(objectStore1.indexNames.length, 2, "2 Indexes on object store successfully created");
        _(objectStore1.indexNames);
        start();
        stop();
    };
    dbOpenRequest.onblocked = function(e){
        _("Opening database blocked");
        ok(false, "Opening database blocked");
        start();
        stop();
    };
});

function openObjectStore(name, storeName, callback){
    queuedAsyncTest(name, function(){
        var dbOpenRequest = xc_indexedDB.open(DB.NAME);
        dbOpenRequest.onsuccess = function(e){
            _("Database opened successfully");
            var db = dbOpenRequest.result;
            var transaction = db.transaction([DB.OBJECT_STORE_1, DB.OBJECT_STORE_2], "readwrite");
            var objectStore = transaction.objectStore(DB.OBJECT_STORE_1);
            callback(objectStore);
        };
        dbOpenRequest.onerror = function(e){
            ok(false, "Database NOT Opened successfully");
            _("Database NOT opened successfully");
            start();
            nextTest();
        };
    });
}

openObjectStore("Check index exists after reopening database", DB.OBJECT_STORE_1, function(objectStore){
    equal(objectStore.indexNames.length, 2, "2 Indexes on still exist");
    _(objectStore.indexNames);
    start();
    nextTest();
});

openObjectStore("Check index keyPath exists after reopening database", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    equal(index.keyPath, "Int", "keyPath on index still exists");
    start();
    nextTest();
});

var key = sample.integer();
var value = sample.obj();
openObjectStore("Adding data after index is created", DB.OBJECT_STORE_1, function(objectStore){
    var addReq = objectStore.add(value, key);
    addReq.onsuccess = function(e){
        equal(key, addReq.result, "Data successfully added");
        _("Added to datastore with index " + key);
        start();
        nextTest();
    };
    addReq.onerror = function(){
        ok(false, "Could not add data");
        start();
        nextTest();
    };
});
openObjectStore("Index Cursor", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    var indexCursorReq = index.openCursor();
    indexCursorReq.onsuccess = function(){
        var cursor = indexCursorReq.result;
        if (cursor) {
            _("Iterating over cursor " + cursor.key + " for value " + JSON.stringify(cursor.value));
            cursor["continue"]();
        }
        else {
            ok(true, "Cursor Iteration completed");
            start();
            nextTest();
        }
    };
    indexCursorReq.onerror = function(){
        _("Error on cursor request");
        ok(false, "Could not continue opening cursor");
        start();
        nextTest();
    };
});

openObjectStore("Index Key Cursor", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    var indexCursorReq = index.openKeyCursor();
    indexCursorReq.onsuccess = function(){
        var cursor = indexCursorReq.result;
        if (cursor) {
            _("Iterating over cursor " + cursor.key + " for value " + JSON.stringify(cursor.value));
            cursor["continue"]();
        }
        else {
            ok(true, "Cursor Iteration completed");
            start();
            nextTest();
        }
    };
    indexCursorReq.onerror = function(){
        _("Error on cursor request");
        ok(false, "Could not continue opening cursor");
        start();
        nextTest();
    };
});

openObjectStore("Index Get", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    var req = index.get(value.Int);
    req.onsuccess = function(){
        deepEqual(req.result, value, "Got object from Index Get");
        console.log("Got ", req.result, value);
        start();
        nextTest();
    };
    req.onerror = function(){
        _("Error on cursor request");
        ok(false, "Could not continue opening cursor");
        start();
        nextTest();
    };
});


openObjectStore("Index Get Key", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    var req = index.getKey(value.Int);
    req.onsuccess = function(){
        equal(req.result, key, "Got key from Index Get");
        console.log("Got ", req.result, value);
        start();
        nextTest();
    };
    req.onerror = function(){
        _("Error on cursor request");
        ok(false, "Could not continue opening cursor");
        start();
        nextTest();
    };
});

openObjectStore("Index update Cursor", DB.OBJECT_STORE_1, function(objectStore){
    var index = objectStore.index("Int Index");
    var indexCursorReq = index.openCursor(IDBKeyRange.only(value.Int));
    indexCursorReq.onsuccess = function(){
        var cursor = indexCursorReq.result;
        if (cursor) {
            var cursorValue = cursor.value;
            cursorValue.updated = true;
            var updateReq = cursor.update(cursorValue);
            updateReq.onerror = function() {
                ok(false, "Cursor update failed");
                start();
                nextTest();
            };
            updateReq.onsuccess = function() {
                ok(true, "Cursor update succeeded");
                var checkReq = index.openCursor(IDBKeyRange.only(value.Int));
                checkReq.onsuccess = function() {
                    deepEqual(checkReq.result.value, cursorValue, "Update check succeeded");
                    start();
                    nextTest();
                };
                checkReq.onerror = function() {
                    ok(false, "cursor check failed");
                    start();
                    nextTest();
                };
            };
        }
        else {
            ok(false, "Cursor expected");
            start();
            nextTest();
        }
    };
    indexCursorReq.onerror = function(){
        _("Error on cursor request");
        ok(false, "Could not continue opening cursor");
        start();
        nextTest();
    };
});

queuedAsyncTest("Deleting Indexes", function(){
    var dbOpenRequest = window.indexedDB.open(DB.NAME, ++dbVersion);
    dbOpenRequest.onsuccess = function(e){
        ok(true, "Database Opened successfully");
        _("Database opened successfully with version");
        dbOpenRequest.result.close();
        nextTest();
        start();
    };
    dbOpenRequest.onerror = function(e){
        ok(false, "Database NOT Opened successfully");
        _("Database NOT opened successfully");
        nextTest();
        start();
    };
    dbOpenRequest.onupgradeneeded = function(e){
        ok(true, "Database Upgraded successfully");
        _("Database upgrade called");
        var db = dbOpenRequest.result;
        var objectStore1 = dbOpenRequest.transaction.objectStore(DB.OBJECT_STORE_1);
        var count = objectStore1.indexNames.length;

        var index3 = objectStore1.createIndex("DeleteTestIndex", "String");
        equal(objectStore1.indexNames.length, count + 1, "Index on object store successfully created");
        objectStore1.deleteIndex("DeleteTestIndex");
        equal(objectStore1.indexNames.length, count, "Index on object store successfully deleted");
        objectStore1.createIndex("DeleteTestIndex", "Int");
        equal(objectStore1.indexNames.length, count + 1, "Index with previously deleted name successfully created");
        objectStore1.deleteIndex("DeleteTestIndex");
        equal(objectStore1.indexNames.length, count, "Index with previously deleted name successfully deleted");

        _(objectStore1.indexNames);
        start();
        stop();
    };
    dbOpenRequest.onblocked = function(e){
        _("Opening database blocked");
        ok(false, "Opening database blocked");
        start();
        stop();
    };
});
