describe('IDBTransaction events', function() {
    "use strict";

    it('should fire the oncomplete event if a transaction completes successfully', function(done) {
        util.createDatabase('inline', function(err, db) {
            var tx = db.transaction('inline', 'readwrite');

            var store = tx.objectStore('inline');
            var add = store.add({id: 1});
            add.onsuccess = sinon.spy();

            tx.oncomplete = function() {
                sinon.assert.calledOnce(add.onsuccess);
                db.close();
                done();
            };
        });
    });

    it('should fire the oncomplete event if a transaction does nothing', function(done) {
        util.createDatabase('inline', function(err, db) {
            var tx = db.transaction('inline', 'readwrite');

            tx.oncomplete = function() {
                db.close();
                done();
            };
        });
    });

    it('should fire the oncomplete event if a synchronous error occurs', function(done) {
        util.createDatabase('inline', function(err, db) {
            var tx = db.transaction('inline', 'readonly');  // <-- read-only
            tx.onerror = sinon.spy();

            var store = tx.objectStore('inline');
            var errored = false;
            try {
                store.add({id: 1});                         // <-- This causes a synchronous error
            }
            catch (e) {
                errored = true;
            }

            tx.oncomplete = function() {
                expect(errored).to.be.true;
                sinon.assert.notCalled(tx.onerror);         // <-- transaction.onerror never fires
                db.close();
                done();
            };
        });
    });

    it('should fire the onerror event if an asynchronous error occurs', function(done) {
        util.createDatabase('inline', function(err, db) {
            var tx = db.transaction('inline', 'readwrite');

            var store = tx.objectStore('inline');
            store.add({id: 1});
            var add = store.add({id: 1});                       // <-- This causes an asynchronous error (duplicate id)
            add.onerror = sinon.spy();
            add.onsuccess = sinon.spy();

            tx.onerror = function() {
                sinon.assert.calledOnce(add.onerror);
                sinon.assert.notCalled(add.onsuccess);
                sinon.assert.notCalled(tx.oncomplete);          // <-- transaction.oncomplete never fires
                db.close();
                done();
            };

            tx.oncomplete = sinon.spy(function () {
                if (add.onsuccess.called) {
                    db.close();
                    done(new Error('IDBObjectStore.add() should have thrown an error when two records were added with the same primary key'));
                }
            });
        });
    });

    it('should not fire the onerror event if an error occurs during oncomplete', function(done) {
        util.createDatabase('inline', function (err, db) {
            var tx = db.transaction('inline', 'readwrite');
            tx.onabort = sinon.spy();

            tx.onerror = sinon.spy(function() {
                db.close();
                done(new Error('The onerror event fired when it should not have'));
            });

            tx.oncomplete = sinon.spy(function() {
                sinon.assert.notCalled(tx.onerror);
                sinon.assert.notCalled(tx.onabort);
                throw new Error('Test Error');
            });

            var onerror = window.onerror;
            window.onerror = function() {
                sinon.assert.calledOnce(tx.oncomplete);
                sinon.assert.notCalled(tx.onerror);
                sinon.assert.notCalled(tx.onabort);

                window.onerror = onerror;
                db.close();
                done();
                return true;
            };

            window.addEventListener('cordovacallbackerror', function handler() {
                window.removeEventListener('cordovacallbackerror', handler);
                db.close();
                done(new Error('The WebSQL plugin suppressed an error event. (window.onerror should have fired)'));
            });
        });
    });

    it('should not fire the onerror event if an error occurs during onabort', function(done) {
        util.createDatabase('inline', function(err, db) {
            var tx = db.transaction('inline', 'readwrite');
            tx.onerror = sinon.spy();
            tx.oncomplete = sinon.spy();

            tx.onabort = sinon.spy(function() {
                sinon.assert.notCalled(tx.onerror);
                sinon.assert.notCalled(tx.oncomplete);
                throw new Error('Test Error');
            });

            tx.abort();

            var onerror = window.onerror;
            window.onerror = function() {
                sinon.assert.calledOnce(tx.onabort);
                sinon.assert.notCalled(tx.onerror);
                sinon.assert.notCalled(tx.oncomplete);

                window.onerror = onerror;
                db.close();
                done();
                return true;
            };
        });
    });
});
