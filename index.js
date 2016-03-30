var express = require("express");
var bp = require("body-parser");
var jade = require("jade");
var fs = require("fs");
var cookieParser = require("cookie-parser");
var app = express();
var NUM_PER_PAGE = 30; //Number.MAX_VALUE;
app.use(cookieParser());

var config;
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch(e) {
  config = {username: "user", password: "pass"};
  fs.writeFileSync("config.json", JSON.stringify(config, null, "\t"), "utf8");
}

var auth = require("node-auth")(config);
var posts;
var nextPost;

try {
  posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
  nextPost = posts.nextPost || 0;
  posts = posts.posts;
} catch(e) {
  console.log(e);
  fs.writeFileSync("posts.json", "{}", "utf8");
  process.exit();
}

app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.use(express.static("static/"));
app.use(bp.urlencoded({extended: true}));
app.get("/", function(req, res) {
  res.render("index", { posts: trimPosts(posts.reverse()), singleView: false });
});

app.get("/post/:id", function(req, res) {
  var id = req.params.id;
  var post = findPost(id);
  if(post) {
    res.render("index", { posts: post, singleView: true,  });
  } else {
    res.sendStatus(404);
  }
});

app.post("/post/:id/addComment", function(req, res) {
  var id = req.params.id;
  var comment = {
    name: req.body.name,
    text: req.body.comment,
    posted: getPostTime()
  }
  var commentId = addComment(id, comment);
  if(commentId !== false) {
    res.redirect("/post/" + id +"#comment-" + commentId);
  } else {
    res.send(`
      Could not add comment to post ${id}
      <br/> Redirecting in 5 seconds
      <script>
        setTimeout(function() {
          window.location.href = "/";
        }, 5000);
      </script>
    `)
  }
});

function searchTitles(search) {
  console.log("key: %s", search);
  if(search == "")
    return [];
  var results = [];
  for(var i = 0; i < posts.length; i++ ) {
    if(posts[i].title.indexOf(search) != -1) {
      results.push(posts[i]);
    }
  }
  return results;
}

function searchAll(search) {
  var results = [];
  if(search == "")
    return [];
  for(var i = 0; i < posts.length; i++ ) {
    if(posts[i].title.indexOf(search) != -1) {
      results.push(posts[i]);
    }
    for(var j = 0 ; j < posts[i].body.length; j++) {
      if(posts[i].body[j].indexOf(search)) {
        results.push(posts[i]);
      }
    }
  }
  return results;
}

function pruneDuplicates(arr) {
  var results = [];
  var ids = [];
  for(var i = 0 ; i < arr.length; i++) {
    if(ids.indexOf(arr[i].id) == - 1) {
      results.push(arr[i]);
      ids.push(arr[i].id)
    }
  }
  return results;
}

function trimPosts(posts, page) {
  if(page)
    page--;
  else
    page = 0;
  var base = page * NUM_PER_PAGE;
  var max = base + NUM_PER_PAGE;
  var result = [];
  for(var i = base ; i < max && i < posts.length; i++) {
    result.push(posts[i]);
  }
  return result;
}

function searchAllKeys(str, titlesOnly) {
  var keys = str.split(" ");
  var results = [];
  if(titlesOnly) {
    for(var i = 0; i < keys.length; i++ ) {
      var tmp = searchTitles(keys[i]);
      for(var j = 0 ; j < tmp.length; j++) {
        results.push(tmp[j]);
      }
    }
  } else {
    for(var i = 0 ; i < keys.length; i++) {
      var tmp = searchAll(keys[i]);
      for(var j = 0 ; j < tmp.length; j++) {
        results.push(tmp[j]);
      }
    }
  }
  return pruneDuplicates(results);
}

app.post("/search", function(req, res) {
  if(req.body.search == "Titles") {
    var search = searchAllKeys(req.body.query, true);
      res.render('index', { posts: trimPosts(search.reverse()), singleView: search.length == 1 });
    } else {
    var search = searchAllKeys(req.body.query, false);
    res.render("index", { posts: trimPosts(search.reverse()), singleView: search.length == 1 });
  }
});

app.get("/post", auth, function(req, res) {
  res.render("post");
});

app.post("/post", auth, function(req, res) {
  var post = {};
  post.title = req.body.title;
  if(req.body.body.indexOf("\r\n") != -1)
    post.body = req.body.body.split("\r\n\r\n");
  else
    post.body = req.body.body.split("\n\n");
  post.nextComment = 0;
  post.comments = [];
  post.created = getPostTime();
  var id = addPost(post);
  res.redirect("/post/" + id);
});

function addPost(post) {
  var id = nextPost++;
  post.id = id;
  posts.push(post);
  save();
  return id;
}

function findPost(id) {
  for(var i = 0 ; i < posts.length; i++) {
    if(posts[i].id == id)
      return [ posts[i] ];
  }
  return false;
}

function addComment(id, comment) {
  for(var i = 0 ; i < posts.length; i++) {
    if(posts[i].id == id) {
      var commentId = 0;
      if(posts[i].comments.length > 0) {
        commentId = posts[i].comments[posts[i].comments.length - 1].id + 1;
      }
      comment.id = commentId;
      posts[i].comments.push(comment);
      save();
      return commentId;
    }
  }
  return false;
}

function save() {
  fs.writeFileSync("posts.json", JSON.stringify({ posts: posts, nextPost: nextPost }, null, "\t"), "utf8");
}

function getPostTime() {
  var t = new Date();
  var days = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"]
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var day = days[t.getDay()];
  var month = months[t.getMonth()];
  var date = t.getDate();
  var year = t.getUTCFullYear();
  var hour = t.getHours();
  var minute = t.getMinutes();
  var second = t.getSeconds();
  return day + " " + month + " " + date + " " + year + " " + hour + ":" + minute + ":" + second;
}

module.exports = app;