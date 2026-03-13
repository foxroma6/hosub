from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fish-market-secret-2024')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///fish_market.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = '로그인이 필요합니다.'


# ── Models ──────────────────────────────────────────────

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200))
    bank_name = db.Column(db.String(50))
    bank_account = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    fish_listings = db.relationship('Fish', backref='seller', lazy=True)


class Fish(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    species = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(300))
    weight = db.Column(db.String(50))
    location = db.Column(db.String(100))
    status = db.Column(db.String(20), default='판매중')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    chat_rooms = db.relationship('ChatRoom', backref='fish', lazy=True)


class ChatRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fish_id = db.Column(db.Integer, db.ForeignKey('fish.id'), nullable=False)
    buyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    buyer = db.relationship('User', foreign_keys=[buyer_id])
    seller = db.relationship('User', foreign_keys=[seller_id])
    messages = db.relationship('Message', backref='room', lazy=True, order_by='Message.created_at')


class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_room.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship('User', foreign_keys=[sender_id])


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


# ── Routes ──────────────────────────────────────────────

@app.route('/')
def index():
    species_filter = request.args.get('species', '')
    search = request.args.get('search', '')

    query = Fish.query.filter_by(status='판매중')
    if species_filter:
        query = query.filter(Fish.species == species_filter)
    if search:
        query = query.filter(
            Fish.title.contains(search) | Fish.species.contains(search)
        )

    fish_list = query.order_by(Fish.created_at.desc()).all()
    species_list = [s[0] for s in db.session.query(Fish.species).distinct().all()]

    return render_template('index.html', fish_list=fish_list, species_list=species_list,
                           selected_species=species_filter, search=search)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(request.args.get('next') or url_for('index'))
        flash('이메일 또는 비밀번호가 올바르지 않습니다.', 'error')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')

        if User.query.filter_by(email=email).first():
            flash('이미 사용 중인 이메일입니다.', 'error')
            return render_template('register.html')
        if User.query.filter_by(username=username).first():
            flash('이미 사용 중인 닉네임입니다.', 'error')
            return render_template('register.html')

        user = User(username=username, email=email,
                    password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        login_user(user)
        flash('환영합니다! 가입이 완료되었습니다.', 'success')
        return redirect(url_for('index'))
    return render_template('register.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


@app.route('/fish/new', methods=['GET', 'POST'])
@login_required
def fish_new():
    if request.method == 'POST':
        image_url = None
        if 'image' in request.files:
            file = request.files['image']
            if file.filename:
                filename = secure_filename(file.filename)
                os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
                file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                image_url = f'uploads/{filename}'

        fish = Fish(
            seller_id=current_user.id,
            title=request.form.get('title'),
            species=request.form.get('species'),
            price=int(request.form.get('price', 0)),
            description=request.form.get('description'),
            weight=request.form.get('weight'),
            location=request.form.get('location'),
            image_url=image_url,
        )
        db.session.add(fish)
        db.session.commit()
        flash('판매 등록이 완료되었습니다!', 'success')
        return redirect(url_for('fish_detail', fish_id=fish.id))
    return render_template('fish_new.html')


@app.route('/fish/<int:fish_id>')
def fish_detail(fish_id):
    fish = Fish.query.get_or_404(fish_id)
    chat_room = None
    if current_user.is_authenticated and fish.seller_id != current_user.id:
        chat_room = ChatRoom.query.filter_by(
            fish_id=fish_id, buyer_id=current_user.id
        ).first()
    return render_template('fish_detail.html', fish=fish, chat_room=chat_room)


@app.route('/fish/<int:fish_id>/delete', methods=['POST'])
@login_required
def fish_delete(fish_id):
    fish = Fish.query.get_or_404(fish_id)
    if fish.seller_id != current_user.id:
        flash('권한이 없습니다.', 'error')
        return redirect(url_for('fish_detail', fish_id=fish_id))
    db.session.delete(fish)
    db.session.commit()
    flash('게시글이 삭제되었습니다.', 'success')
    return redirect(url_for('my_page'))


@app.route('/fish/<int:fish_id>/status', methods=['POST'])
@login_required
def update_status(fish_id):
    fish = Fish.query.get_or_404(fish_id)
    if fish.seller_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    status = request.json.get('status')
    if status in ['판매중', '예약중', '판매완료']:
        fish.status = status
        db.session.commit()
    return jsonify({'status': fish.status})


@app.route('/fish/<int:fish_id>/chat/start')
@login_required
def start_chat(fish_id):
    fish = Fish.query.get_or_404(fish_id)
    if fish.seller_id == current_user.id:
        flash('본인 게시물에는 채팅을 시작할 수 없습니다.', 'error')
        return redirect(url_for('fish_detail', fish_id=fish_id))

    room = ChatRoom.query.filter_by(fish_id=fish_id, buyer_id=current_user.id).first()
    if not room:
        room = ChatRoom(fish_id=fish_id, buyer_id=current_user.id, seller_id=fish.seller_id)
        db.session.add(room)
        db.session.commit()
    return redirect(url_for('chat', room_id=room.id))


@app.route('/chat/<int:room_id>')
@login_required
def chat(room_id):
    room = ChatRoom.query.get_or_404(room_id)
    if current_user.id not in [room.buyer_id, room.seller_id]:
        flash('접근 권한이 없습니다.', 'error')
        return redirect(url_for('index'))
    return render_template('chat.html', room=room)


@app.route('/chat/<int:room_id>/send', methods=['POST'])
@login_required
def send_message(room_id):
    room = ChatRoom.query.get_or_404(room_id)
    if current_user.id not in [room.buyer_id, room.seller_id]:
        return jsonify({'error': 'Unauthorized'}), 403

    content = request.json.get('content', '').strip()
    if not content:
        return jsonify({'error': 'Empty message'}), 400

    message = Message(room_id=room_id, sender_id=current_user.id, content=content)
    db.session.add(message)
    db.session.commit()

    return jsonify({
        'id': message.id,
        'content': message.content,
        'sender': current_user.username,
        'is_mine': True,
        'created_at': message.created_at.strftime('%H:%M'),
    })


@app.route('/chat/<int:room_id>/messages')
@login_required
def get_messages(room_id):
    room = ChatRoom.query.get_or_404(room_id)
    if current_user.id not in [room.buyer_id, room.seller_id]:
        return jsonify({'error': 'Unauthorized'}), 403

    last_id = request.args.get('last_id', 0, type=int)
    messages = Message.query.filter(
        Message.room_id == room_id,
        Message.id > last_id
    ).order_by(Message.created_at).all()

    return jsonify([{
        'id': m.id,
        'content': m.content,
        'sender': m.sender.username,
        'is_mine': m.sender_id == current_user.id,
        'created_at': m.created_at.strftime('%H:%M'),
    } for m in messages])


@app.route('/my')
@login_required
def my_page():
    my_listings = Fish.query.filter_by(seller_id=current_user.id).order_by(Fish.created_at.desc()).all()
    buy_rooms = ChatRoom.query.filter_by(buyer_id=current_user.id).all()
    sell_rooms = ChatRoom.query.filter_by(seller_id=current_user.id).all()
    return render_template('my_page.html', my_listings=my_listings,
                           buy_rooms=buy_rooms, sell_rooms=sell_rooms)


@app.route('/my/bank', methods=['POST'])
@login_required
def update_bank():
    current_user.bank_name = request.form.get('bank_name')
    current_user.bank_account = request.form.get('bank_account')
    db.session.commit()
    flash('계좌 정보가 저장되었습니다.', 'success')
    return redirect(url_for('my_page'))


# Social login placeholders
@app.route('/auth/naver')
def naver_login():
    flash('네이버 로그인은 준비 중입니다.', 'info')
    return redirect(url_for('login'))


@app.route('/auth/kakao')
def kakao_login():
    flash('카카오 로그인은 준비 중입니다.', 'info')
    return redirect(url_for('login'))


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
