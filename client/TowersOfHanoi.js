'use strict'
/* global $ location io */

const DEFAULT_DIFFICULTY = 4
const STARTING_WIDTH = 100
const DEFAULT_RESET_BTN_MSG = 'request-reset'
var resetButtonMsg = DEFAULT_RESET_BTN_MSG

function makeid (length) {
  var result = ''
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

var resetKey = makeid(8)

$(function () {
  var socket = io()
  // $('.header').load('../header.html')
  resetGame()
  var gameOver = false
  var $stacks = $('[data-stack]')
  // since only last child of every stack is allowed to make the move,
  // give them class movable
  $('[data-block]:last-child').addClass('movable')
  // any block is draggable,
  // but they revert to original position unless condition is met
  var draggableData = {
    revert: true,
    start: function (ev) {
      console.log('start')
      socket.emit('start', {
        target: $(ev.target).attr('data-block'),
        x: ev.pageX - ev.offsetX,
        y: ev.pageY - ev.offsetY
      })
    },
    drag: function (ev) {
      socket.emit('drag', {
        target: $(ev.target).attr('data-block'),
        x: ev.pageX - ev.offsetX,
        y: ev.pageY - ev.offsetY
      })
    },
    stop: function (ev) {
      console.log('stop')
      socket.emit('stop', {
        target: $(ev.target).attr('data-block'),
        destination: $(ev.target.parentElement).attr('data-stack')
      })
    }
  }
  $('[data-block]:last-child').draggable(draggableData)

  function saveState (state) {
    var newString = window.location.search
    if (newString.indexOf('state') > 0) {
      const diffReg = /state=[^&]+/
      newString = newString.replace(diffReg, `state=${JSON.stringify(state)}`)
      var newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + newString
      window.history.pushState({ path: newUrl }, '', newUrl)
    } else {
      var prefix = '?'
      if (newString.length > 0) {
        prefix = '&'
      }
      newString += `${prefix}state=${JSON.stringify(state)}`
      var newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + newString
      window.history.pushState({ path: newUrl }, '', newUrl)
    }
  }

  function serialize () {
    let serialized = []
    $('[data-stack]').map((_, elem) =>
      $(elem).children('[data-block]').map((_, elem) => $(elem).attr('data-block'))
    ).each((_, elem) => serialized.push(elem.toArray()))

    return serialized
  }

  function dropFunction (ev, ui) {
    if (!gameOver) {
      if (goodToDrop($(this), ui.draggable)) {
        ui.draggable.draggable('option', 'revert', false)
        $(this).append(ui.draggable.detach())
        ui.draggable.css({ 'top': 0, 'left': 0 })
        // reset things
        $('[data-block]').removeClass('movable')
        $('[data-block]:last-child').addClass('movable')
        $('[data-block]:last-child').draggable(draggableData)
        var state = serialize()
        socket.emit('new-state', state)
        if ($('#moves').text() && parseInt($('#moves').text()) >= 0) {
          $('#moves').text(parseInt($('#moves').text()) + 1)
        } else {
          $('#moves').text(0)
        }
        saveState(state)
        // checkForWin
        checkForWin()
      }
    } else {
      resetGame()
    }
  }
  // only when droppable is true, can a movable block be dropped
  $stacks.droppable({
    accept: '.movable',
    drop: dropFunction
  })

  function goodToDrop ($stack, $block) {
    var $lastBlock = $stack.children().last()
    if (parseInt($block.attr('data-block')) < parseInt($lastBlock.attr('data-block')) || $stack.children().length === 0) {
      return true
    } else {
      return false
    }
  }

  function checkForWin () {
    if ($('[data-stack="3"]').children().length === $('[data-block]').length) {
      $('#announce-game-won').html('You Won!')
      gameOver = true
    }
  }

  function updateLocation (newString) {
    var prefix = '?'
    if (location.search.length > 0) {
      prefix = '&'
    }
    var newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + window.location.search + prefix + newString
    window.history.pushState({ path: newUrl }, '', newUrl)
  }

  function fixLocationDifficulty (diff) {
    console.log('fix')
    var newString = window.location.search
    const diffReg = /difficulty=[^&]+/
    newString = newString.replace(diffReg, `difficulty=${diff}`)
    var newUrl = window.location.protocol + '//' + window.location.host + window.location.pathname + newString
    window.history.pushState({ path: newUrl }, '', newUrl)
  }

  function resetGame () {
    var params = new URLSearchParams(location.search)
    var difficulty = DEFAULT_DIFFICULTY
    // console.log(difficulty)
    var gameid = makeid(4)

    if (params.get('difficulty')) {
      difficulty = parseInt(params.get('difficulty'))
      if (difficulty === null || typeof (difficulty) !== 'number' || difficulty < 1 || difficulty > 8) {
        fixLocationDifficulty(DEFAULT_DIFFICULTY)
      }
    } else {
      updateLocation(`difficulty=${difficulty}`)
    }

    if (params.get('gameid')) {
      gameid = params.get('gameid')
    } else {
      updateLocation(`gameid=${gameid}`)
    }
    socket.emit('game-info', { difficulty: difficulty, gameid: gameid })
    let resetString = ''
    for (let index = 0; index < difficulty; index++) {
      resetString += `<div data-block="${STARTING_WIDTH - 10 * index}"></div>`
    }
    // console.log('difficulty', difficulty, resetString)
    $('[data-stack="1"]').html(resetString)
    $('[data-stack="2"]').empty()
    $('[data-stack="3"]').empty()
    $('#announce-game-won').empty()
    gameOver = false
    $('#reset').prop('disabled', false)
    $('.controls').css('background-color', 'inherit')
    resetButtonMsg = DEFAULT_RESET_BTN_MSG
    resetKey = makeid(8)
    $('[data-block]:last-child').draggable(draggableData)
    $('#moves').text(0)
  }

  socket.on('start', function (info) {
    var e = {}
    console.log('start')
    var target = $(`[data-block=${info.target}]`).draggable()// .appendTo("#outer");
    target.css('position', 'absolute')
    target.addClass('ui-draggable-dragging')
    e.type = 'dragStart'
    e.target = target[0]
    target.css('left', info.x)
    target.css('top', info.y)
    target.trigger(e)
  })

  socket.on('drag', function (info) {
    // console.log('drag')
    var e = {}
    var target = $(`[data-block=${info.target}]`)
    // target.css('position', 'absolute')
    e.type = 'drag'
    e.target = target[0]
    target.css('left', info.x)
    target.css('top', info.y)
    target.trigger(e)
  })

  socket.on('stop', function (info) {
    console.log('stop')
    var e = {}
    var target = $(`[data-block=${info.target}]`)// .appendTo("#outer");
    target.removeClass('ui-draggable-dragging')
    e.type = 'dragStop'
    e.target = target[0]
    target.css('left', 0)
    target.css('top', 0)
    target.trigger(e)
    target.appendTo($(`[data-stack=${info.destination}]`))
    target.css('position', 'relative')
    $('[data-block]').removeClass('movable')
    $('[data-block]:last-child').addClass('movable')
    $('[data-block]:last-child').draggable(draggableData)
    // checkForWin
    saveState(serialize())
    checkForWin()
  })

  function deserialize (info) {
    $('[data-block]').appendTo('body')
    info.state.forEach((stack, idx) =>
      stack.forEach((block) =>
        $(`[data-stack=${idx + 1}]`).append($(`[data-block=${block}]`))
      )
    )
    $('[data-block]:last-child').draggable(draggableData)
    if ('moves' in info) {
      $('#moves').text(info.moves)
    } else {
      $('#moves').text(0)
    }
    saveState(info.state)
  }

  socket.on('start-state', function (info) {
    deserialize(info)
  })

  socket.on('difficulty-correction', function (info) {
    fixLocationDifficulty(info.difficulty)
    if ('state' in info) {
      deserialize(info)
    }
  })

  $('#reset').click(() => {
    socket.emit(resetButtonMsg, {
      resetKey: resetKey
    })
    $('#reset').prop('disabled', true)
    if (resetButtonMsg !== DEFAULT_RESET_BTN_MSG) {
      resetGame()
    }
  })

  socket.on('request-reset', info => {
    resetButtonMsg = 'do-reset'
    resetKey = info.resetKey
    $('.controls').css('background-color', 'red')
  })

  socket.on('reset', () => {
    resetGame()
  })

  socket.on('moves', info => {
    $('#moves').text(info.moves)
  })
})
