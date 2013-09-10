/**
 * Require needed modules and define variables
 **/
var fs = require('fs'),
crypto = require('crypto'),
app = {
  'meta':         {}, 
  'path':         {'articles': null, 'pages': null},
  'files':        {'articles': [], 'pages': []},
  'data':         {'articles': {}, 'pages': {}, 'hidden': {}},
  'tags':         {},
  'default':      {},
  'admin':        []}, 
exports = module.exports = app;

/** 
 * Set general meta information
 * @param string name
 * @param mixed value
 **/
exports.setMeta = function(name, value) { this.meta[name] = value; };

/**
 * Count words 
 * @param string s
 * @return intenger 
 **/
var countWords = function(s) { return !s ? 0 : (s.split(/^\s+$/).length === 2 ? 0 : 2 + s.split(/\s+/).length - s.split(/^\s+/).length - s.split(/\s+$/).length); };

/** 
 * Set default information
 * @param string name
 * @param mixed value
 **/
exports.setDefault = function(key, value) { this.default[key] = value; };

/** 
 * Get default information
 * @param string key
 * @return mixed
 **/
exports.getDefault = function(key) { return this.default[key]; };

/** 
 * Add admin login
 * @param object user
 **/
exports.addLogin = function(user) { app.admin.push(user); };

/** 
 * Get current session
 * @return object
 **/
//exports.getSession = function() { return {'valid': app.userIsAdmin, 'maxID': app.maxID}; };

/**
 * Check given login and run callback
 * @param string name
 * @param string password
 * @param function callback
 */
exports.checkLogin = function(name, password) {
  for(var i = 0; i < app.admin.length; i ++) {
    var cur = app.admin[i];
    if(cur.username == name)
      return cur.password == password || cur.password == crypto.createHash('sha1').update(password).digest('hex');
  }
  return false;
};

/**
 * Update article file
 * @param integer id 
 * @param string content
 **/
exports.updateArticle = function(id, data) {
  if (this.data.hidden[id]) {
    var curItem = this.data.hidden[id]; } 
  else {
    var curItem = this.data.articles[id]; }
  
  var fd = fs.openSync(curItem.directory+'article.html', 'w+', 0666);
  fs.writeSync(fd, data);
  fs.closeSync(fd);
  
  this.index(this.path.articles);
};

/**
 * Remove a entire directory
 * @param directory path with trailing slash
 **/
function rmDirSync(dirPath) {
  try { var files = fs.readdirSync(dirPath); }
  catch(e) { return; }
  if(files.length > 0)
    for(var i = 0; i < files.length; i++) {
      var filePath = dirPath + '/' + files[i];
      if(fs.statSync(filePath).isFile())
        fs.unlinkSync(filePath);
      else
        rmDir(filePath);
    }
  fs.rmdirSync(dirPath);
};

/**
 * Remove article file
 * @param integer id
 **/
exports.removeArticle = function(id) {
  if (this.data.hidden[id])
    var curItem = this.data.hidden[id];
  else
    var curItem = this.data.articles[id];
  
  rmDirSync(curItem.directory);
  
  this.index(this.path.articles);
};

/**
 * Create new article
 * @param string name
 * @return string article url
 **/
exports.createNewArticle = function(data) {
  if(!data.name || data.pid != app.nextID) return null;
  
  var curID = app.nextID ++, now = new Date(),
      newFile = this.path.articles + '/' + curID + '/';
  
  function padStr(i) {
    return (i < 10) ? '0'+i : ''+i;
  }

  fs.mkdirSync(newFile);
  var fd = fs.openSync(newFile+'article.html', 'w+', 0666);
  fs.writeSync(fd,'{\n'+
    '\t"Name": "'+data.name+'",\n'+
    '\t"Hidden": true,\n'+
    '\t"Date": "'+now.getFullYear()+'-'+padStr(now.getMonth()+1)+'-'+padStr(now.getDate())+' '+padStr(now.getHours())+':'+padStr(now.getMinutes())+':'+padStr(now.getSeconds())+'",\n'+
    '\t"Tags": ["Example"],\n'+
    '\t"Category": "Example",\n'+
    '\t"Sources": {"example.com": "http://example.com/"}\n'+
    '};\n\n'+
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas orci nibh, convallis ac venenatis at, aliquet eget neque. Nulla tortor nulla, varius quis ultricies sit amet, posuere nec velit. In hac habitasse platea dictumst. Suspendisse a nulla lacus, dignissim dignissim felis. Morbi ut dui lacus. Sed aliquet tristique malesuada. Morbi sit amet neque eu nunc fringilla sollicitudin. Quisque condimentum arcu non odio pulvinar eget placerat mauris auctor. Quisque quam nulla, vestibulum vitae tincidunt eu, lacinia eget metus. Nam commodo cursus facilisis. Nam convallis porta orci, in sodales erat vestibulum quis.'
  );
  fs.closeSync(fd);
  this.index(this.path.articles);
  return curID;
};

/**
 * Merge data with needed framework information for jade rendering
 * @param array data
 * @return array
 **/
exports.jadeData = function(data, req) {
  data['session'] = {'valid': req.isAdmin, 'nextID': app.nextID};
  data['meta'] = this.meta;
  
  return data;
};

/**
 * Initialize data structure 
 * @param string dir directory for articles
 **/
exports.index = function(dir) {
  this.path.articles = dir;
  this.data.articles = {};
  this.data.pages = {};
  this.data.hidden = {};
  this.tags = [];
  this.files.articles = fs.readdirSync(this.path.articles).sort();
  this.processArticles();
};

/**
 * Parse file 
 * @param string b filename
 **/
exports.parseFile = function(filename) {
  var result = {
    'id': parseInt(filename),
    'hidden': true,
    'name': filename,
    'url': this.default.url+'/posts/'+filename,
    'directory': this.path.articles+'/'+filename+'/',
    'category': this.default.category,
    'date': new Date(),
    'tags': []
  };

  result.html = result.content = fs.readFileSync(result.directory+'article.html').toString();
  var seperator = result.content.indexOf('};\n\n');
  if(seperator > -1) {
    try {
      var header = JSON.parse(result.content.substr(0, seperator+1));
      result.html = result.content.substr(seperator+4).replace(/"resources\//gi, '"'+this.default.url+'/resources/'+result.id+'/');
      
      if(!header.Hidden || header.Hidden == false)
        result.hidden = false;
      if(typeof header.Name == 'string')
        result.name = header.Name.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
      if(typeof header.Category == 'string')
        result.category = header.Category;
      if(typeof header.Date == 'string')
        result.date = new Date(header.Date);
  
      if(header.Sources)
        result.sources = header.Sources;
  
      if(header.Tags)
        result.tags = header.Tags;
    }catch(e) {
      
    };
  }

  //result.hash = crypto.createHash('md5').update(result.name).digest('hex').substr(8, 6);
  return result;
};

/**
 * Get article
 * @param integer id
 * @param boolean showPreview include hidden files
 * @return object
 **/
exports.getArticle = function(id, showPreview) {
  if (showPreview == true && this.data.hidden[id]) {
    return this.data.hidden[id]; }
  if (!this.data.articles[id] || this.data.articles[id].hidden == true) {
    return null; }
  else {
    return this.data.articles[id]; }
};

/**
 * Get drafts
 * @return array
 **/
exports.getDrafts = function() {
  var data = [];
  for (var n in this.data.hidden) {
    if (!this.data.hidden[n].url || this.data.hidden[n].url == '') {
      continue; }
      
    data.push({'id': n, 'name': this.data.hidden[n].name, 'url': this.data.hidden[n].url, 'date': this.data.hidden[n].date});
  };
  
  return data.reverse();
};

/**
 * Get articles
 * @return array
 **/
exports.getArticles = function() {
  var data = [];
  for (var n in this.data.articles) {
    if (this.data.articles[n] && (!this.data.articles[n].hidden || this.data.articles[n].hidden == false)) {
      data.push(this.data.articles[n]); } }
  return data.reverse();
};

/**
 * Get articles by tag
 * @param string $tap
 * @return array
 **/
exports.getArticlesByTag = function(tag) {
  return this.tags[tag];
};

/**
 * Process articles
 **/
exports.processArticles = function() {
  app.nextID = 0;
  for(var a = this.files.articles.length; a --; ) {
    if(!fs.statSync(this.path.articles+'/'+this.files.articles[a]).isDirectory())
      continue;

    var article = this.parseFile(this.files.articles[a]);
    if(!article) continue;
    if(article.id > app.nextID) app.nextID = article.id;
    article.words = countWords(article.content);
    article.excerpt = article.html.split('</p>')[0] + '</p>';
    
    if(article.hidden)
      this.data.hidden[article.id] = article;
    else {
      this.data.articles[article.id] = article;
      
      for(var i = 0; i < article.tags.length; i++) { 
        var tag = article.tags[i]; 
        if(!this.tags[tag])
          this.tags[tag]=[];
        this.tags[tag].push(article);
      }
    }
  }
  app.nextID ++;
};

/**
 * Get Tag cloud
 * @param integer max maximum font size
 * @param integer min minimum font size 
 * @return object
 **/
exports.getTagCloud = function(max, min) {
  var data = {}, numbers = [];
  for (var n in this.tags) {
    if (typeof(this.tags[n]) == 'function') {
      continue; }  
    data[n] = this.tags[n].length;
    numbers.push(data[n]);
  }
  
  var maxqty = numbers.max();
  var minqty = numbers.min();
  var spread = maxqty - minqty;
  if (spread == 0) {
    spread = 1; }
  var step = (max - min) / spread;
  var sizes = {};
  
  for (var n in data) {
    var cur = data[n];
    sizes[n] = Math.round(min + ((cur - minqty) * step));
  }

  return sizes;
};

/**
 * Add min() and max() functions to Arrays
 **/
Array.prototype.max = function() { return Math.max.apply(null, this) };
Array.prototype.min = function() { return Math.min.apply(null, this) };

/** 
 * Trim stringt
 * @param string str
 * @return strin
 **/
function trim(str) { return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(/ +(?= )/g,''); }

/**
 * Strip HTML tags from string
 * @param string input
 * @param string allowed
 * @return string
 **/
function strip_tags (input, allowed) {
  // https://raw.github.com/kvz/phpjs/master/functions/strings/strip_tags.js
  allowed = (((allowed || "") + "").toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('');
  var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;
  return input.replace(commentsAndPhpTags, '').replace(tags, function ($0, $1) {
    return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
  });
}