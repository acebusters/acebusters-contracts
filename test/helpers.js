module.exports = function() {
  this.ethUtil = require('ethereumjs-util');
  this.sign = function(privStr, payloadStr) {
    const priv = new Buffer(privStr.replace('0x', ''), 'hex');
    const payload = new Buffer(payloadStr.replace('0x', ''), 'hex');
    const hash = this.ethUtil.sha3(payload);
    const sig = this.ethUtil.ecsign(hash, priv);
    return {
    	v: sig.v,
    	r: '0x' + sig.r.toString('hex'),
    	s: '0x' + sig.s.toString('hex'),
    };
  };
  this.signStr = function(privStr, payloadStr) {
    const priv = new Buffer(privStr.replace('0x', ''), 'hex');
    const payload = new Buffer(payloadStr.replace('0x', ''), 'hex');
    const hash = this.ethUtil.sha3(payload);
    const sig = this.ethUtil.ecsign(hash, priv);
    return sig.r.toString('hex') + sig.s.toString('hex') + sig.v.toString(16);
  };
}
