const mongoose = require("mongoose");

const ReviewerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    expertise: { type: String, required: true } // Uzmanlık alanı
});

module.exports = mongoose.model("Reviewer", ReviewerSchema);
