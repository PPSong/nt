var express = require('express')
var router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')
const {User, Follows, Fans, Friends} = require('../models/models')

async function getNewFollows (userId, startTime) {
  result = await Follows.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

async function getNewFans (userId, startTime) {
  result = await Fans.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

async function getNewFriends (userId, startTime) {
  result = await Friends.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {title: 'Express'})
})

router.post('/follow/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    try {
      //检查userId是否有对应用户
      const targetUser = await User.findOne({_id: userId})
      if (targetUser == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此目标用户!'})
      }

      const followResult = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: false,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      const fansResult = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: false,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult == null || fansResult.deleted == true) {
        //确认记录确实从无到有, 或者从deleted == true 到 deleted == false, 应该要通知Fans的ownerUserId

        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_fans'})

        //检查是否已成为好友
        const tmpResult = await Follows.findOne({
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: false
        })

        const now = Date.now()

        if (tmpResult != null) {
          //结成好友
          const friendResult1 = await Friends.findOneAndUpdate({
              ownerUserId: userId,
              targetUserId: user._id
            },
            {
              ownerUserId: userId,
              targetUserId: user._id,
              deleted: false,
              updateTime: now
            },
            {
              upsert: true,
              new: false
            })

          const friendResult2 = await Friends.findOneAndUpdate({
              ownerUserId: user._id,
              targetUserId: userId
            },
            {
              ownerUserId: user._id,
              targetUserId: userId,
              deleted: false,
              updateTime: now
            },
            {
              upsert: true,
              new: false
            })

          global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_friends'})

          global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_friends'})

        }
      }

      global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_follows'})

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/unFollow/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    try {
      //检查是否可以unfollow(非朋友 and 自己的follow中有对方)
      const tmpFriend = await Friends.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFriend != null) {
        return res
          .status(500)
          .json({code: -1, error: '已是互为好友, 不能取消关注, 只能解除好友!'})
      }

      const tmpFollow = await Follows.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFollow == null) {
        return res
          .status(500)
          .json({code: -1, error: '关注列表无此用户, 不能取消关注!'})
      }

      //检查userId是否有对应用户
      const targetUser = await User.findOne({_id: userId})
      if (targetUser == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此目标用户!'})
      }

      const followResult = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult != null || followResult.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知Follows的ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_follows'})
      }

      const fansResult = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult != null || fansResult.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知Fans的ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_fans'})
      }

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/unFriend/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    try {
      //检查是否可以unfriend(朋友)
      const tmpFriend = await Friends.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFriend == null) {
        return res
          .status(500)
          .json({code: -1, error: '不是好友, 不能解除好友!'})
      }

      //取消好友, follows, fans从此是路人
      const friendResult1 = await Friends.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (friendResult1 != null || friendResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_friends'})
      }

      const friendResult2 = await Friends.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (friendResult2 != null || friendResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_friends'})
      }

      const followResult1 = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult1 != null || followResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_follows'})
      }

      const followResult2 = await Follows.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult2 != null || followResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_follows'})
      }

      const fansResult1 = await Fans.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult1 != null || fansResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_fans'})
      }

      const fansResult2 = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult2 != null || fansResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_fans'})
      }

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFollows/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFollows(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFans/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFans(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFriends/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFriends(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getUserInfo/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    const userId = req.params.userId

    try {
      const result = await User.findById({
          _id: userId
        },
        {
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getOtherUsers', async function (req, res, next) {
  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: '用户不合法!'})
    }

    try {
      const result = await User.find({
          _id: {$ne: user._id}
        },
        {
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

module.exports = router
