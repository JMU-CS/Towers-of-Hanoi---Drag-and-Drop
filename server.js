const PORT = process.env.PORT || 80
var express = require('express')
var app = express()
var http = require('http').createServer(app)
var io = require('socket.io')(http)

// app.get('/', function (req, res) {
//   res.sendFile(__dirname + '/index.html')
// })
const GAME_ROOM_IDX = 1
app.use(express.static('client'))

const CLIENT_TO_ROOM = {}
const GAME_ROOM_TO_GAME_INFO = {}

io.on('connection', function (socket) {
  console.log('a user connected')

  socket.on('disconnect', reason => {
    if (socket.id in CLIENT_TO_ROOM && CLIENT_TO_ROOM[socket.id] in GAME_ROOM_TO_GAME_INFO && 'clients' in GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]]) {
      console.log(CLIENT_TO_ROOM[socket.id], 'user disconnected', socket.id)
      GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients = GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients.filter(id => id !== socket.id)
    } else {
      console.log('user disconnected', socket.id)
    }
    delete CLIENT_TO_ROOM[socket.id]
  })

  socket.on('game-info', function (info) {
    console.log(info.gameid, 'game-info')
    // if this person was in another game, drop them from it
    if (socket.id in CLIENT_TO_ROOM) {
      if (CLIENT_TO_ROOM[socket.id] in GAME_ROOM_TO_GAME_INFO && 'clients' in GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]]) {
        GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients = GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id]].clients.filter(id => id !== socket.id)
      }
      delete CLIENT_TO_ROOM[socket.id]
    }
    if (!(info.gameid in GAME_ROOM_TO_GAME_INFO)) {
      GAME_ROOM_TO_GAME_INFO[info.gameid] = info
      GAME_ROOM_TO_GAME_INFO[info.gameid].clients = [socket.id]
      GAME_ROOM_TO_GAME_INFO[info.gameid].moves = 0
    } else {
      if (GAME_ROOM_TO_GAME_INFO[info.gameid].difficulty === info.difficulty) {
        if ('state' in GAME_ROOM_TO_GAME_INFO[info.gameid]) {
          socket.emit('start-state', GAME_ROOM_TO_GAME_INFO[info.gameid])
        }
      } else {
        console.log('ERROR difficulty mismatch')
        socket.emit('difficulty-correction', GAME_ROOM_TO_GAME_INFO[info.gameid])
      }
      GAME_ROOM_TO_GAME_INFO[info.gameid].clients.push(socket.id)
    }
    CLIENT_TO_ROOM[socket.id] = info
    socket.join(info.gameid)
  })

  socket.on('start', function (info) {
    // console.log('start')
    socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('start', info)
  })

  socket.on('drag', function (info) {
    // console.log('drag')
    socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('drag', info)
  })

  socket.on('stop', function (info) {
    // console.log('stop')
    socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('stop', info)
  })

  socket.on('new-state', function (newState) {
    console.log(CLIENT_TO_ROOM[socket.id].gameid, 'new-state', newState)
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].state = newState
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].moves++
    socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('moves', { moves: GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].moves })
  })
  socket.on('request-reset', (info) => {
    console.log(CLIENT_TO_ROOM[socket.id].gameid, 'request-reset')
    if (GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].clients.length === 1) {
      delete GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].state
      GAME_ROOM_TO_GAME_INFO[info.gameid].moves = 0
      socket.emit('reset')
    }
    GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].resetKey = info.resetKey
    socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('request-reset', {
      resetKey: info.resetKey
    })
  })

  socket.on('do-reset', (info) => {
    console.log(CLIENT_TO_ROOM[socket.id].gameid, 'do-reset')
    if (GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].resetKey === info.resetKey) {
      delete GAME_ROOM_TO_GAME_INFO[CLIENT_TO_ROOM[socket.id].gameid].state
      GAME_ROOM_TO_GAME_INFO[info.gameid].moves = 0
      socket.to(CLIENT_TO_ROOM[socket.id].gameid).emit('reset')
    }
  })
})

http.listen(PORT, function () {
  console.log(`listening on *:${PORT}`)
})
