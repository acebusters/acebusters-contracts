module.exports = function() {
  this.ethUtil = require('ethereumjs-util');
  this.sign = function(privStr, payloadStr) {
    var priv = new Buffer(privStr.replace('0x', ''), 'hex');
    var payload = new Buffer(payloadStr.replace('0x', ''), 'hex');
    var hash = this.ethUtil.sha3(payload);
    var sig = this.ethUtil.ecsign(hash, priv);
    return {
    	v: sig.v,
    	r: '0x' + sig.r.toString('hex'),
    	s: '0x' + sig.s.toString('hex'),
    };
  };
}
