/* Include the static file webserver library */
var static = require('node-static');
/* Include the http servier library */
var http = require('http');
/*  assume that we are running on heroku */
var port = process.env.PORT;
var directory = __dirname + '/public';


/*  if we aren't on heroku we need to readjust port and directory information and we know that because port wont be set */
if(typeof port == 'undefined' || !port) {
  directory = './public';
  port = 8080;
}

/*  set up a static web servier that will deliver files form the file system */
var file = new static.Server(directory);

/*  construct an http server that gets files form the file server */
var app = http.createServer(
  function(request,response){
    request.addListener('end',
      function(){
        file.serve(request,response);
      }
    ).resume();
  }
).listen(port);

console.log('The Server is running');