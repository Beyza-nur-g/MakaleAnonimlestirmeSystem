const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    articleId: {
        type: String,
        required: true,
    },
      
    sender: {
        type: String,
        enum: ["yazar", "editor"],
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model("Message", messageSchema);
