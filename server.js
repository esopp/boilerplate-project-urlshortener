'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var {Schema} = mongoose;
var cors = require('cors');
var dns = require('dns');
var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
// mongoose.connect(process.env.MONGOLAB_URI);
//does not work with Mongoose 4.X, updated to ^5.4.17 and solved connection issue
mongoose.connect(process.env.MONGOLAB_URI, {useMongoClient: true}, (err) => {
  if (err) console.error(err);
  else console.log('connected to db');
});
  


const urlPairSchema = new Schema({
  'long' : String, 
  'short' : Number
});
var UrlPair = mongoose.model("UrlPair", urlPairSchema);

/* Look for long url in the database. 
If a document with the long url exists, 
return the existing document. Else create 
and return a new entry*/
function createAndSaveUrlPair (urlObject, done) {
  console.log('open create and save', urlObject)
  existingLongUrl(urlObject, (err, data) => {
    if (err) return done(err);
    else if (data) done(null, data); //pass existing entry to done()
    else { //create new entry
      UrlPair.estimatedDocumentCount((err, count) => {
        if (err) return done(err);
        var pair = new UrlPair({"long": urlObject.long, "short": count});
        console.log('par exist', pair)
        pair.save((err, data) => {
          console.log('save did something')
          if (err) return done(err);
          done(null, data);
        });
      }); 
    } //end create new entry
  });  
}

//called by createAndSaveUrlPair to check if long url already has an entry 
function existingLongUrl(urlObject, done) {
  UrlPair.findOne(urlObject, (err, data) => {
    if (err) return done(err);
    done(null, data);
  })
}

//find document by mini url
function lookupMiniUrl(id, done) {
  UrlPair.findOne({"short" : id}, (err, data) => err ? done(err) : done(null, data));
}

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

app.post("/api/shorturl/new", (req, res) => {
  let body = "";  
  req.on('data', (d) => body += d);
  req.on('end', () => {
    body = decodeURIComponent(body.substr(4, body.length));
    let lookupStr = body.replace(/https?:\/\//, '');
    dns.lookup(lookupStr, (err, data) => {
      if (err || body.match(/https?:\/\//) === null) res.json({'error': "invalid URL"});
      else createAndSaveUrlPair({"long": body}, (err, data) => {
        if (err) {
          res.end('Error creating url pair.');
          console.error(err);
        }
        else {
          res.json({"original_url" : data.long, "short_url": data.short})
        }
      }); //createAndSaveUrlPair()
    }); //dns.lookup()
  }); //req.on('end')
}); //POST "/api/shortcut/new"

app.get("/api/shorturl/:url", (req, res) => {
  if (isNaN(req.params.url)) res.json({'error': 'wrong url format'});
  else lookupMiniUrl(parseInt(req.params.url), (err, data) => {
    if (err) res.json({'error': 'error looking up short url'});
    else if (data === null) res.json({'error': 'could not find url'});
    else res.redirect(data.long);
  });
}); // GET "/api/shorturl/:url"

app.listen(port, function () {
  console.log('Node.js listening ...');
});


