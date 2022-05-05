const fs = require('fs');
const b32 = require('hi-base32');
const crypto = require("hypercore-crypto");


const run = (password, email, address)=>{
  const keyPair = crypto.keyPair(crypto.data(Buffer.from(password)));
  const bkey = b32.encode(keyPair.publicKey).replace('====','').toLowerCase();
  console.log('Address will be: ', bkey+".matic.ml");
  fs.mkdirSync('sites/'+bkey+'/', { recursive: true }, (err) => {console.log(err)});
  fs.writeFileSync('.env', 'KEY='+password);
  fs.writeFileSync('sites/'+bkey+'/hyperconfig.json', JSON.stringify({key:password, target:address}));
  fs.writeFileSync('sites/'+bkey+'/config.json', JSON.stringify({sites:[{subject:bkey+".matic.ml"}], maintainerEmail:email}));
  fs.writeFileSync('address', bkey+".matic.ml");
}


const checks = async ()=>{
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const ask = (q)=>{
    return new Promise(res=>{rl.question(q, result=>res(result))});
  }
  const password = process.env.password || ask('Enter your private seed for key generation');
  const email = process.env.email || ask('Enter your contact email');
  const target = process.env.target || ask('Enter your private seed for key generation');
  run(process.env.PASSWORD, process.env.EMAIL, process.env.ADDRESS);
  rl.on('close', function () {
    process.exit(0);
  });
  rl.close();
}


