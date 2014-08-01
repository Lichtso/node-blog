/**
 * Load config JSON file
 **/
var core = require('./core.js'),
    fs = require('fs');
var config = JSON.parse(fs.readFileSync(__dirname + '/config.json','utf8'));

/**
 * Set default category and set default URL
 **/
core.setDefault('category', 'General');
core.setDefault('url', 'http://' + config.host);

/**
 * Set basic variables passed to jade template
 **/
 
core.setMeta('site', config.host); 
core.setMeta('url', 'http://' + config.host);
core.setMeta('author', config.author);
core.setMeta('name', config.name);

/**
 * Add admin logins
 **/
for(i in config.admins)
  core.addLogin(config.admins[i]);

/**
 * Index articles folder
 **/
core.index(__dirname + '/' + config.paths.articles);
/**
 * Start express.js http servr with kickstart (more: http://semu.mp/node-kickstart.html)
 **/
var kickstart = require('kickstart').withConfig({'name': config.host, 'port': config.port, 'path': __dirname});
var srv = kickstart.srv();

/**
 * Set error handling
 **/
srv.error(function(err, req, res, next){
  if(err instanceof NotFound) {
    core.setMeta('url', core.getDefault('url') + req.url);
    core.setMeta('title', '404 Not Found');
      
    res.statusCode = 404;
    res.render('errors/404', core.jadeData({url: req.url}, req)); } 
  else {
    next(err); }
});

/**
 * Check session data
 **/
srv.all('*', function(req, res, next) {
  if (req.session && req.session.valid) {
    req.isAdmin = true; } else { req.isAdmin = false; }
  next();
});

/**
 * Callback for creating new articles
 **/
srv.all('/api/new', function(req, res) {
  var newName = '';
  if(req.session && req.body.name && (newName += core.createNewArticle(req.body)) != null)
    return res.end(newName);
  else
    return res.end('0');
});

/**
 * Callback for creating new articles
 **/
srv.all('/api/drafts', function(req, res) {
  if(req.session)
    return res.end(JSON.stringify(core.getDrafts()));
  else
    return res.end('0');
});

/**
 * Callback for authenticating user session
 **/
srv.post('/api/auth', function(req, res) {
  if(core.checkLogin(req.body.name, req.body.password)) {
    req.session.valid = true;
      res.end('1');
  }else{
    if(req.session) {
      req.isAdmin = false;
      delete req.session;
    }
    res.end('0');
  }
});

/**
 * Callback for logout user session
 **/
srv.all('/api/logout', function(req, res) {
  if(req.session)
    req.session.destroy();
  res.end('0');
});

/**
 * Display all posts available
 * @example http://semu.mp/posts
 **/
srv.all('/posts', function(req, res) {
  core.setMeta('url', core.getDefault('url') + req.url);
  core.setMeta('title', 'Articles');
  core.setMeta('headline', 'Recent Articles');
  core.setMeta('current', 'posts');  

  res.render('posts', core.jadeData({list: core.getArticles(), tags: core.getTagCloud(30, 14)}, req));
});

/**
 * Deploy blog post resources
 * @example http://semu.mp/resource/3158/example.png
 **/
srv.get(/\/resources\/([0-9]+)\/(.+)/, function(req, res) {
  var item = core.getArticle([req.params[0]], req.session.valid);
  var fileStat = fs.statSync(item.directory+req.params[1]);
  if(!item || req.params[1] == 'article.html' || !fileStat.isFile())
    throw new NotFound;
  
  res.sendfile(req.params[1], {'root': item.directory});
  console.log("GET Resource: "+item.directory+req.params[1]);
});

/**
 * Display single blog post
 * @example http://semu.mp/posts/3158
 **/
srv.all(/\/posts\/([0-9]+)/, function(req, res) {
  var hasSession = req.session.valid;

  if(hasSession) {
    var updateData = req.param('data', null);
    if(updateData)
      core.updateArticle(req.params[0], updateData);
    else if(req.param('remove', null)) {
      core.removeArticle(req.params[0]);
      return res.redirect('/posts');
    }
  }
  
  var item = core.getArticle([req.params[0]], hasSession);
  if(!item)
    throw new NotFound;
  if(item.url != core.getDefault('url') + req.url)
    return res.redirect(item.url, 301);
    
  core.setMeta('url', item.url);
  core.setMeta('title', item.name);
  core.setMeta('headline', item.name); 
  core.setMeta('current', 'posts');
  
  res.render('article', core.jadeData({article: item, auth: req.session.valid}, req));
});

/**
 * Display articles by tag
 * @example http://semu.mp/tag/node
 **/
srv.all(/\/tag\/([A-Za-z0-9\-]+)/, function(req, res) {
  var articles = core.getArticlesByTag(req.params[0]) || [];
  core.setMeta('url', core.getDefault('url') + req.url);
  core.setMeta('title', 'Tag: ' + req.params[0]);
  core.setMeta('headline', 'Tagged with ' + req.params[0]);  
  core.setMeta('current', 'posts');
  
  res.render('posts', core.jadeData({tags: core.getTagCloud(30, 14), list: articles}, req));
});

/**
 * Display about
 * @example http://semu.mp/about
 */
srv.all('/about', function(req, res) {
  core.setMeta('url', core.getDefault('url') + req.url);
	core.setMeta('title', 'About');
  core.setMeta('current', 'about');
	
  res.render('about', core.jadeData({}, req));
});

/**
 * Display Index
 * @example http://semu.mp/ 
 **/
srv.all('/', function(req, res) {
	core.setMeta('url', core.getDefault('url'));
	core.setMeta('title', 'Home');
  core.setMeta('current', 'home');

  return res.render('home', core.jadeData({list: core.getArticles()}, req));
});

/**
 * Export RSS Feed
 * @example http://semu.mp/feed 
 **/
srv.all('/feed', function(req, res) {
  return res.render('feed', core.jadeData({url: core.getDefault('url') + req.url, layout: false, list: core.getArticles()}, req));
});

/**
 * Display single page or throw errors
 **/
srv.all('*', function(req, res, next) {
  throw new NotFound;
});

/**
 * FileNotFound Exception
 * @param string msg
 **/
function NotFound(msg) {
  this.name = 'NotFound';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
} NotFound.prototype.__proto__ = Error.prototype;

/**
 * Trim strings
 * @param string str
 * @return array
 */
function trim(str) { return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(/ +(?= )/g,''); }

/**
 *
 * Start node-blog
 *
 **/
var router = kickstart.listen();
console.log("Listening on http://%s:%d", kickstart.conf().name, router.address().port);