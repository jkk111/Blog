var express = require("express");
var bp = require("body-parser");
var jade = require("jade");
var fs = require("fs");
var app = express();
var posts;
try {
  posts = JSON.parse(fs.readFileSync("posts.json", "utf8"));
} catch(e) {
  console.log(e);
  fs.writeFileSync("posts.json", "[]", "utf8");
  process.exit();
}
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.use(express.static("static/"));
app.use(bp.urlencoded({extended: true}));
app.get("/", function(req, res) {
  res.render("index", { posts: posts, singleView: false });
});

app.get("/post/:id", function(req, res) {
  var id = req.params.id;
  var post = findPost(id);
  if(post) {
    res.render("index", { posts: post, singleView: true });
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
  if(commentId) {
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
  var results = [];
  for(var i = 0; i < posts.length; i++ ) {
    if(posts[i].title.indexOf(search) != -1) {
      results.push(posts[i]);
    }
  }
  return results;
}

app.post("/search", function(req, res) {
  if(req.body.search == "Titles") {
    var search = searchTitles(req.body.query);
    res.render('index', { posts: search, singleView: false });
  } else {
    res.send("not implemented yet<br/>Sorry :P");
  }
});

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
  fs.writeFileSync("posts.json", JSON.stringify(posts, null, "\t"), "utf8");
}

app.listen(80);


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
