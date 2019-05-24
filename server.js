/* Set up the static file server*/

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

/* A registry of socket IDs and player info */

var players = [];

/* setup web server socket */
var io = require('socket.io').listen(app);
io.sockets.on('connection',function(socket) {
  log('Client connection by '+socket.id);


  function log() {
    var array = [ '*** Server Log Message: '];
    for (var i = 0; i< arguments.length; i++){
      array.push(arguments[i]);
      console.log(arguments[i]);
    }
    socket.emit('log', array);
    socket.broadcast.emit('log',array);
  }




/* join_room command */
/* payload: 
/*   {
 *      'room': room to join,
 *      'username': username of person joining 
      }
      join_room_response,
      'result' : 'success',
      'room' : room joined,
      'username' : username that joined,
      'socket_id': the socket id of the person that joined,
      'membership'  : number of people that joined the room including the new one
      }
      or
      join_room_response,
      'result' : 'fail',
      'message' : failure_message,
      }
*/
  socket.on('join_room',function(payload){
    log('\'join_room\' command '+JSON.stringify(payload));

    /* check that the client sent a payload */
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'join_room had no payload, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that the client has a room to join */
    var room = payload.room;
    if(('undefined' === typeof room) || !room){
      var error_message = 'join_room did not specify a room, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that a username has been provided */
    var username = payload.username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'join_room did not specify a username, command aborted';
      log(error_message);
      socket.emit('join_room_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* store information about this new player */
    players[socket.id] = {};
    players[socket.id].username = username;
    players[socket.id].room = room;

    /* actually have the user join the room */
    socket.join(room);

    /* Get the room object */
    var roomObject = io.sockets.adapter.rooms[room];

    /* Tell everyone in the room that someone joined */
    var numClients = roomObject.length;
    var success_data = {
                          result: 'success',
                          room: room,
                          username: username,
                          socket_id: socket.id,
                          membership: numClients
                        };
    io.in(room).emit('join_room_response', success_data);

    for(var socket_in_room in roomObject.sockets){
      var success_data = {
                          result: 'success',
                          room: room,
                          username: players[socket_in_room].username,
                          socket_id: socket_in_room,
                          membership: numClients
                          };
      socket.emit('join_room_response', success_data);
    }

    log('join_room success');
  });

  socket.on('disconnect',function(){
    log('Client disconnected '+JSON.stringify(players[socket.id]));

    if('undefined' !== typeof players[socket.id] && players[socket.id]){
      var username = players[socket.id].username;
      var room = players[socket.id].room;
      var payload = {
        username: username,  
        socket_id: socket.id
      };
      delete players[socket.id];
      io.in(room).emit('player_disconnected',payload);
      }

  });


/* send_message command */
/* payload: 
/*   {
 *      'room': room to join,
 *      'username': username of person sending the message
        'message':  the message to send 
      }
      send_message_response,
      'result' : 'success',
      'username' : username that sent the message,
      'message'  : the message
      }
      or
      'result' : 'fail',
      'message' : failure_message,
      }
*/

socket.on('send_message',function(payload){
    log('server received a command', 'send_message',payload);
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'send_message had no payload, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var room = payload.room;
    if(('undefined' === typeof room) || !room){
      var error_message = 'send_message did not specify a room, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var username = payload.username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'send_message did not specify a username, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var message = payload.message;
    if(('undefined' === typeof message) || !message){
      var error_message = 'send_message did not specify a message, command aborted';
      log(error_message);
      socket.emit('send_message_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var success_data = {
                          result: 'success',
                          room: room,
                          username: username,
                          message: message
                        };
    io.sockets.in(room).emit('send_message_response',success_data);
    log('Message sent to room ' + room + ' by ' + username);
    });

});





