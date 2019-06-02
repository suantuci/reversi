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

    if(room !== 'lobby'){
      send_game_update(socket,room,'initial update');
    }


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

    var username = players[socket.id].username;
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
    io.in(room).emit('send_message_response',success_data);
    log('Message sent to room ' + room + ' by ' + username);
    });

/* invite command */
/* payload: 
/*   {
 *      'requested_user': socket id of the person to be invited
      }
      invite_response:
      'result' : 'success',
      'socket_id' : socket id of the person being invited 
      }
      or
      'result' : 'fail',
      'message' : failure_message,
      }
      invited:
      'result' : 'success',
      'socket_id' : socket id of the person being invited 
      }
      or
      'result' : 'fail',
      'message' : failure_message,
      }
*/

socket.on('invite',function(payload){
    log('invite with '+JSON.stringify(payload));

    /* check payload sent*/
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'invite had no payload, command aborted';
      log(error_message);
      socket.emit('invite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that the message can be traced to a username */
    var username = players[socket.id].username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'invite cannot identify who sent message, command aborted';
      log(error_message);
      socket.emit('invite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var requested_user = payload.requested_user;
    if(('undefined' === typeof requested_user) || !requested_user){
      var error_message = 'invite did not specify a requested_user, command aborted';
      log(error_message);
      socket.emit('invite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
      var error_message = 'invite requested a user not in the room, command aborted';
      log(error_message);
      socket.emit('invite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* if all ok, respond to the inviter that it was successful */

    var success_data = {
                          result: 'success',
                          socket_id: requested_user
                        };
    socket.emit('invite_response', success_data);

    /*  Tell the invitee that they have been invited */
    var success_data = {
                          result: 'success',
                          socket_id: socket.id
                        };
    socket.to(requested_user).emit('invited', success_data);
    log('invite successful');
    });

/* uninvite command */
/* payload: 
/*   {
 *      'requested_user': socket id of the person to be uninvited
      }
      uninvite_response:
      'result' : 'success',
      'socket_id' : socket id of the person being uninvited 
      }
      or
      'result' : 'fail',
      'message' : failure_message,
      }
      invited:
      'result' : 'success',
      'socket_id' : socket id of the person doing the uninviting
      }
      or
      'result' : 'fail',
      'message' : failure_message,
      }
*/

socket.on('uninvite',function(payload){
    log('uninvite with '+JSON.stringify(payload));

    /* check payload sent*/
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'uninvite had no payload, command aborted';
      log(error_message);
      socket.emit('uninvite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that the message can be traced to a username */
    var username = players[socket.id].username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'uninvite cannot identify who sent message, command aborted';
      log(error_message);
      socket.emit('uninvite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var requested_user = payload.requested_user;
    if(('undefined' === typeof requested_user) || !requested_user){
      var error_message = 'uninvite did not specify a requested_user, command aborted';
      log(error_message);
      socket.emit('uninvite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
      var error_message = 'invite requested a user not in the room, command aborted';
      log(error_message);
      socket.emit('invite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* if all ok, respond to the uninviter that it was successful */

    var success_data = {
                          result: 'success',
                          socket_id: requested_user
                        };
    socket.emit('uninvite_response', success_data);

    /*  Tell the invitee that they have been uninvited */
    var success_data = {
                          result: 'success',
                          socket_id: socket.id
                        };
    socket.to(requested_user).emit('uninvited', success_data);
    log('uninvite successful');
    });

/* game-start command */
/* payload: 
/*   {
 *      'requested_user': socket id of the person to play with
      }
      game_start_response:
      'result' : 'success',
      'socket_id' : socket id of the person you are playing with,
      'game_id' :  id of the game session
      }
      or
      'result' : 'fail',
      'message' : failure_message
      }
*/

socket.on('game_start',function(payload){
    log('uninvite with '+JSON.stringify(payload));

    /* check payload sent*/
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'game_start had no payload, command aborted';
      log(error_message);
      socket.emit('game_start_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that the message can be traced to a username */
    var username = players[socket.id].username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'game_start cannot identify who sent message, command aborted';
      log(error_message);
      socket.emit('game_start_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var requested_user = payload.requested_user;
    if(('undefined' === typeof requested_user) || !requested_user){
      var error_message = 'uninvite did not specify a requested_user, command aborted';
      log(error_message);
      socket.emit('uninvite_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var room = players[socket.id].room;
    var roomObject = io.sockets.adapter.rooms[room];
    /* make sure the user being invited is in the room */
    if(!roomObject.sockets.hasOwnProperty(requested_user)){
      var error_message = 'game_start requested a user not in the room, command aborted';
      log(error_message);
      socket.emit('game_start_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* if all ok, respond to the game_starter that it was successful */
    var game_id = Math.floor((1+Math.random()) *0x10000).toString(16).substring(1);
    var success_data = {
                          result: 'success',
                          socket_id: requested_user,
                          game_id: game_id
                        };

    socket.emit('game_start_response', success_data);

    /*  Tell the other player to play */
    var success_data = {
                          result: 'success',
                          socket_id: socket.id,
                          game_id: game_id
                        };
    socket.to(requested_user).emit('game_start_response', success_data);
    log('game_start successful');
    });

/* play_token command */
/* payload: 
/*   {
        'row': 0-7 column to play token on
        'column': 0-7 column to play token on
        'color': 'white or black'
      }

      if successful a success message will be follow by a game_update message

      play_token_response:
      'result' : 'success',
      }
      or
      'result' : 'fail',
      'message' : failure_message
      }
*/

socket.on('play_token',function(payload){
    log('play_token with '+JSON.stringify(payload));

    /* check payload sent*/
    if(('undefined' === typeof payload) || !payload){
      var error_message = 'play_token had no payload, command aborted';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    /* check that player previously registered */
    var player = players[socket.id];
    if(('undefined' === typeof player) || !player){
      var error_message = 'server doesnt recognize you, try going back one screen';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var username = players[socket.id].username;
    if(('undefined' === typeof username) || !username){
      var error_message = 'play_token cant identify who sent message';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var game_id = players[socket.id].room;
    if(('undefined' === typeof game_id) || !game_id){
      var error_message = 'play_token can\'t find your game board';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var row = payload.row;
    if(('undefined' === typeof row) || row < 0 || row > 7){
      var error_message = 'play_token did not specify a valid row, command aborted';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var column = payload.column;
    if(('undefined' === typeof column) || column < 0 || row > 7){
      var error_message = 'play_token did not specify a valid column, command aborted';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var color = payload.color;
    if(('undefined' === typeof color) || !color || (color != 'white' && color != 'black')){
      var error_message = 'play_token did not specify a valid color, command aborted';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var game = games[game_id];
    if(('undefined' === typeof game) || !game){
      var error_message = 'play_token couldn\'t find your game board';
      log(error_message);
      socket.emit('play_token_response', {
        result: 'fail',
        message: error_message
      });
      return;
    }

    var success_data = {
                result: 'success'
    };

    socket.emit('play_token_response', success_data);

    /* Execute the move */
    if(color == 'white'){
      game.board[row][column] = 'w';
      game.whose_turn = 'black';
    }
    else if(color == 'black'){
      game.board[row][column] = 'b';
      game.whose_turn = 'white';
    }

    var d = new Date();
    game.last_move_time = d.getTime();

    send_game_update(socket,game_id,'played a token');

});



});

/* this is code related to the game state */
var games = [];

function create_new_game(){
  var new_game = {};
  new_game.player_white = {};
  new_game.player_black = {};
  new_game.player_white.socket = '';
  new_game.player_white.username = '';
  new_game.player_black.socket = '';
  new_game.player_black.username = '';

  var d = new Date();
  new_game.last_move_time = d.getTime();

  new_game.whose_turn = 'white';
  new_game.board = [
          [' ',' ',' ',' ',' ',' ',' ',' '],
          [' ',' ',' ',' ',' ',' ',' ',' '],
          [' ',' ',' ',' ',' ',' ',' ',' '],
          [' ',' ',' ','w','b',' ',' ',' '],
          [' ',' ',' ','b','w',' ',' ',' '],
          [' ',' ',' ',' ',' ',' ',' ',' '],
          [' ',' ',' ',' ',' ',' ',' ',' '],
          [' ',' ',' ',' ',' ',' ',' ',' ']
  ];

  return new_game;
}



function send_game_update(socket, game_id, message){
          /* check game_id exists */
          if (('undefined' === typeof games[game_id])  || !games[game_id])            {
                            console.log('No game exists. Creating '+game_id+' for socket.id');
                            games[game_id] = create_new_game();
                        }
           /*  make sure only 2 in room*/
          var roomObject;
          var numClients;
          do {
              roomObject = io.sockets.adapter.rooms[game_id];
              numClients = roomObject.length;
              if(numClients > 2) {
                console.log('Too many clients in room: '+game_id+' #: '+numClients);
                if(games[game_id].player_white.socket == roomObject.sockets[0]){
                  games[game_id].player_white.socket = '';
                  games[game_id].player_white.username = '';
                }
                if( games[game_id].player_black.socket == roomObject.sockets[0]){
                  games[game_id].player_black.socket = '';
                  games[game_id].player_black.username = '';
                }
                /* kick one of the extra ppl out */
                var sacrifice = Object.keys(roomObject.sockets)[0];
                io.of('/').connected[sacrifice].leave(game_id);
              }
          }
          while ((numClients-1) > 2);

           /*  assign socket a color */
           /*  if current player isn't assigned a color */
           if((games[game_id].player_white.socket != socket.id) && (games[game_id].player_black.socket != socket.id)){
                    console.log('Player isn\'t assigned a color: '+socket.id);
              /* and there isn't a color to give them */
              if((games[game_id].player_black.socket != '') && (games[game_id].player_white.socket != '')){
                    games[game_id].player_white.socket = '';
                    games[game_id].player_white.username = '';
                    games[game_id].player_black.socket = '';
                    games[game_id].player_black.username = '';
              }
           }
           /*  assign colors if not already done */
           if(games[game_id].player_white.socket == ''){
              if(games[game_id].player_black.socket != socket.id){
                games[game_id].player_white.socket = socket.id;
                games[game_id].player_white.username = players[socket.id].username;
              }
           }
            if(games[game_id].player_black.socket == ''){
              if(games[game_id].player_white.socket != socket.id){
                games[game_id].player_black.socket = socket.id;
                games[game_id].player_black.username = players[socket.id].username;
              }
            }


           /*  send game update*/

          var success_data = {
                  result: 'success',
                  game: games[game_id],
                  message: message,
                  game_id: game_id
          };

          io.in(game_id).emit('game_update',success_data);
           /*  check if game is over */

           var row,column;
           var count = 0;
           for (row = 0; row < 8; row++){
              for (column = 0; column < 8; column++){
                if(games[game_id].board[row][column] != ' '){
                  count++;
                }
              }
            }

          if(count == 64){
            /* send a game over message */
            var success_data = {
                                result: 'success',
                                game: games[game_id],
                                who_won: 'everyone',
                                game_id: game_id
                                }
            io.in(game_id).emit('game_over', success_data);

            /* delete old games after 1 hour */
            setTimeout(function(id){
              return function(){
                delete games[id];
                }}(game_id)
              ,60*60*1000);
          }


 }

    




