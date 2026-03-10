from flask import Flask, render_template, jsonify
import random

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/generate")
def generate():
    numbers = sorted(random.sample(range(1, 46), 6))
    return jsonify(numbers=numbers)

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
