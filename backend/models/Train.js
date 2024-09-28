const mongoose = require('mongoose')

const TrainSchema = new mongoose.Schema({
    from:{
        type: String,
        required: true
    },

    to: {
        type:String,
        required: true
    },

    seats: {
        type: Number,
        required: true
    }
})

const Train = mongoose.model('Train', TrainSchema);
module.exports = Train;