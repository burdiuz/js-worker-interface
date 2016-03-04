/**
 * Created by Oleg Galaburda on 03.03.16.
 */
describe('generateWorkerBlobData()', function() {

});
describe('generateBlob()', function() {

});
describe('fullImportScriptURL()', function() {

});
describe('isStandalone()', function() {
  describe('When there are no "Scripts" available', function() {
    beforeEach(function() {
      delete window.Scripts;
    });
    it('should return false', function() {
      expect(isStandalone()).to.be.false;
    });
  });
  describe('When no Scripts.SELF_SRC available', function() {
    beforeEach(function() {
      window.Scripts = {};
    });
    it('should return false', function() {
      expect(isStandalone()).to.be.false;
    });
  });
  describe('When Scripts.SELF_SRC is available', function() {
    beforeEach(function() {
      window.Scripts = {SELF_SRC: ''};
    });
    it('should return false', function() {
      expect(isStandalone()).to.be.true;
    });
  });
  afterEach(function() {
    delete window.Scripts;
  });
});
