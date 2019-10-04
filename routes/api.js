/*
*
*
*       Complete the API routing below
*
*
*/

'use strict'

const expect = require('chai').expect
const mongoose = require('mongoose')
const axios = require('axios').default

const CONNECTION_STRING = process.env.DB || 'mongodb://issue-user:issue123456@ds229108.mlab.com:29108/project-issuetracker'

mongoose.connect(CONNECTION_STRING, { useNewUrlParser: true }, (err) => {
    if (err) return console.log('Connect mongo fail')
    console.log('Connect mongo success')
})

const stockSchema = new mongoose.Schema({
    _id: mongoose.SchemaTypes.ObjectId,
    stock: String,
    price: Number,
    likes: [{ type: String }]
})

const Stock = mongoose.model('Stock', stockSchema)

module.exports = function (app) {
    app.route('/api/stock-prices')
        .get(async (req, res) => {
            const { ip } = req
            let { stock: codes, like } = req.query

            if (!codes) return res.json({ error: 'stock is not valid' })
            if (!Array.isArray(codes)) codes = [codes]
            like = like === 'true' ? true : false

            let data = await Promise.all(codes.map(code => new Promise((res, rej) => {
                code = code.toUpperCase()
                axios.get(`https://api.iextrading.com/1.0/deep/trades?symbols=${code}`)
                    .then(response => {
                        let { price } = response.data[code][0]
                        let update = {
                            $set: { price }
                        }

                        if (like) update['$addToSet'] = { 'likes': ip }


                        return Stock.findOneAndUpdate(
                            { stock: code },
                            update,
                            { new: true, upsert: true, rawResult: true }
                        ).lean().select('-__v -_id').exec()
                    })
                    .then(result => {
                        let stock = result.value
                        stock.likes = stock.likes ? stock.likes.length : 0
                        stock.price = String(stock.price)
                        res(stock)
                    })
                    .catch(error => rej(error))
            })))

            if (data.length === 1) {
                return res.json({ stockData: data[0] })
            }

            data = data.map(item => {
                item.rel_likes = item.likes
                delete item.likes
                return item
            })

            res.json({ stockData: data })

        })
}