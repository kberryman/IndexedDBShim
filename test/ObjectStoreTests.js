queuedModule("Object Store");
queuedAsyncTest("Creating an Object Store with multiple upgrades", function(){
  var dbOpenRequest = xc_indexedDB.open('multiUpgrades', 8);
  dbOpenRequest.onsuccess = function(e){
    ok(true, "Database Opened successfully");
    _("Database opened successfully with version " + dbOpenRequest.result.version);
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
  dbOpenRequest.onupgradeneeded = function(event){
    ok(true, "Database Upgraded successfully");
    _("Database upgrade called");
    var dbUpgrade = {};
    dbUpgrade['1'] = function(event, db, tx){
      var tracksStore = db.createObjectStore('tracks', {keyPath: 'id'});
      tracksStore.createIndex('state_idx', 'state', {unique: false});
      tracksStore.createIndex('name_idx', 'name', {unique: false});
      db.createObjectStore('motor_brands', { autoIncrement : true });
      db.createObjectStore('motor_block_types', { autoIncrement : true });
      db.createObjectStore('motor_head_types', { autoIncrement : true });
      db.createObjectStore('motor_carburetor_manufacturers', { autoIncrement : true });
      db.createObjectStore('motor_barrels', { autoIncrement : true });
      db.createObjectStore('tab_configs', { autoIncrement: true });
      db.createObjectStore('class_configs', {keyPath: 'id'}).createIndex('name_idx', 'name', {unique: true});
      var planConfigStore = db.createObjectStore('plan_configs', {keyPath: 'name'});
      planConfigStore.createIndex('name_idx', 'name', {unique: true});
      db.createObjectStore('security_questions', {keyPath: 'id'});
      var chassisStore = db.createObjectStore('chassis_manufacturers', {autoIncrement : true});
      chassisStore.createIndex('name_idx', 'name', {unique: false});
      chassisStore.createIndex('race_class_idx', 'race_class_id', {unique: false});
      chassisStore.createIndex('id_idx', 'manufacturer_id', {unique: false});
      var userMotorsStore = db.createObjectStore('user_motors', {autoIncrement : true});
      userMotorsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      userMotorsStore.createIndex('id_idx', 'id', {unique: true});
      userMotorsStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var userCarsStore = db.createObjectStore('user_cars', {autoIncrement : true});
      userCarsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      userCarsStore.createIndex('id_idx', 'id', {unique: true});
      userCarsStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var userTracksStore = db.createObjectStore('user_tracks', {autoIncrement : true});
      userTracksStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      userTracksStore.createIndex('id_idx', 'id', {unique: true});
      userTracksStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var userDriversStore = db.createObjectStore('user_drivers', {autoIncrement : true});
      userDriversStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      userDriversStore.createIndex('id_idx', 'id', {unique: true});
      userDriversStore.createIndex('client_id_idx', 'client_id', {unique: true});
      db.createObjectStore('session', { autoIncrement : true });
      var raceStore = db.createObjectStore('races', {autoIncrement : true});
      raceStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      raceStore.createIndex('id_idx', 'id', {unique: true});
      raceStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var requestQueueStore = db.createObjectStore('request_queue', {keyPath: 'primaryKey'});
      requestQueueStore.createIndex('priority_timestamp_idx', ['priority', 'transacted_at'], {unique: false});
      requestQueueStore.createIndex('method_endpoint_idx', ['method', 'endPoint'], {unique: false});
      var dashboardDataStore = db.createObjectStore('dashboard_data', {autoIncrement: true});
      var configStore = db.createObjectStore('configs', {keyPath: 'key'});
    };

    dbUpgrade['2'] = function(event, db, tx){
      db.createObjectStore('race_classes', {keyPath: 'id'});
      db.createObjectStore('race_configs', {keyPath: 'id'}).createIndex('name_idx', 'name', {unique: true});
      var teamMotorsStore = db.createObjectStore('team_motors', {autoIncrement : true});
      teamMotorsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      teamMotorsStore.createIndex('id_idx', 'id', {unique: true});
      teamMotorsStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var teamCarsStore = db.createObjectStore('team_cars', {autoIncrement : true});
      teamCarsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      teamCarsStore.createIndex('id_idx', 'id', {unique: true});
      teamCarsStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var teamTracksStore = db.createObjectStore('team_tracks', {autoIncrement : true});
      teamTracksStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      teamTracksStore.createIndex('id_idx', 'id', {unique: true});
      teamTracksStore.createIndex('client_id_idx', 'client_id', {unique: true});
      var teamDriversStore = db.createObjectStore('team_drivers', {autoIncrement : true});
      teamDriversStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      teamDriversStore.createIndex('id_idx', 'id', {unique: true});
      teamDriversStore.createIndex('client_id_idx', 'client_id', {unique: true});

      db.deleteObjectStore('class_configs');
      db.deleteObjectStore('user_motors');
      db.deleteObjectStore('user_cars');
      db.deleteObjectStore('user_tracks');
      db.deleteObjectStore('user_drivers');
    };

    dbUpgrade['3'] = function(event, db, tx) {
      var userTeamsStore = db.createObjectStore('teams', {keyPath: 'id'});
      userTeamsStore.createIndex('name_idx', 'name', {unique: true});
      userTeamsStore.createIndex('id_idx', 'id', {unique: true});
      userTeamsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      var partsStore = db.createObjectStore('parts', {autoIncrement: true});
      partsStore.createIndex('name_idx', 'name', {unique: false});
      partsStore.createIndex('id_idx', 'id', {unique: true});
      partsStore.createIndex('updated_at_idx', 'updated_at', {unique: false});
      partsStore.createIndex('team_id_idx', 'team_id', {unique: false});
      partsStore.createIndex('team_part_type_id_idx', 'team_part_type_id', {unique: false});
    };

    dbUpgrade['4'] = function(event, db, tx) {
      var teamMotorsStore = tx.objectStore("team_motors");
      teamMotorsStore.createIndex('team_id_idx', 'team_id', {unique: false});
      var teamCarsStore = tx.objectStore("team_cars");
      teamCarsStore.createIndex('team_id_idx', 'team_id', {unique: false});
      var teamTracksStore = tx.objectStore("team_tracks");
      teamTracksStore.createIndex('team_id_idx', 'team_id', {unique: false});
      var teamDriversStore = tx.objectStore("team_drivers");
      teamDriversStore.createIndex('team_id_idx', 'team_id', {unique: false});
    };

    dbUpgrade['5'] = function(event, db, tx) {
      db.createObjectStore('part_usage_units', {autoIncrement: true});
    };

    dbUpgrade['6'] = function(event, db, tx) {
      var partStatusesStore = db.createObjectStore('part_statuses', {keyPath: 'id'});
      partStatusesStore.createIndex('active_idx', 'active', {unique: false});
    };

    dbUpgrade['7'] =function(event, db, tx) {
      var partsStore = tx.objectStore("parts");
      partsStore.createIndex('client_id_idx', 'client_id', {unique: true});
    };

    dbUpgrade['8'] = function(event, db, tx) {
      var partsStore = tx.objectStore("parts");
      partsStore.createIndex('team_part_type_updated_at_idx', ['team_part_type_id', 'updated_at'], {unique: false});
    };

    var oldVersion = event.oldVersion;
    var db = event.target.result;
    var tx = event.target.transaction;
    for (var version in dbUpgrade) {
      if (!dbUpgrade.hasOwnProperty(version) || version <= oldVersion) {
        continue;
      }
      console.log('Running upgrade: ' + version + ' from ' + oldVersion);
      dbUpgrade[version](event, db, tx);
    }

    equal(db.objectStoreNames.length, 25, "Count of Object Stores created is correct");
    _(db.objectStoreNames);
    start();
    stop();
  };

  dbOpenRequest.onblocked = function(){
    ok(false, "Database open is now blocked");
    _("Database open blocked");
    start();
    stop();
  };
});

queuedAsyncTest("Creating an Object Store", function(){
    var dbOpenRequest = xc_indexedDB.open(DB.NAME, ++dbVersion);
    dbOpenRequest.onsuccess = function(e){
        ok(true, "Database Opened successfully");
        _("Database opened successfully with version " + dbOpenRequest.result.version);
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
        db.createObjectStore(DB.OBJECT_STORE_1);
        db.createObjectStore(DB.OBJECT_STORE_2, {
            "keyPath": "Int",
            "autoIncrement": true
        });
        db.createObjectStore(DB.OBJECT_STORE_3, {
            "autoIncrement": true
        });
        db.createObjectStore(DB.OBJECT_STORE_4, {
            "keyPath": "Int"
        });
        var objectStore5 = db.createObjectStore(DB.OBJECT_STORE_5);
        equal(db.objectStoreNames.length, 5, "Count of Object Stores created is correct");
        _(db.objectStoreNames);
        start();
        stop();
    };
    
    dbOpenRequest.onblocked = function(){
        ok(false, "Database open is now blocked");
        _("Database open blocked");
        start();
        stop();
    };
});

queuedAsyncTest("Deleting an Object Store", function(){
    var dbOpenRequest = xc_indexedDB.open(DB.NAME, ++dbVersion);
    dbOpenRequest.onsuccess = function(e){
        ok(true, "Database Opened successfully");
        _("Database opened successfully with version");
        dbOpenRequest.result.close();
        start();
        nextTest();
    };
    dbOpenRequest.onerror = function(e){
        ok(false, "Database NOT Opened successfully");
        _("Database NOT opened successfully");
        start();
        nextTest();
    };
    dbOpenRequest.onupgradeneeded = function(e){
        ok(true, "Database Upgraded successfully, now trying to delete the database");
        _("Database upgrade called");
        var db = dbOpenRequest.result;
        var len = db.objectStoreNames.length;
        db.deleteObjectStore(DB.OBJECT_STORE_5);
        for (var i = 0; i < db.objectStoreNames.length; i++) {
            if (db.objectStoreNames[i] === DB.OBJECT_STORE_5) {
                ok(fail, "Database should not not contain Object Store 5");
            }
        }
        start();
        stop();
    };
    
    dbOpenRequest.onblocked = function(e){
        ok(false, "Database open request blocked");
        _("Database open blocked");
        start();
        stop();
    };
});
