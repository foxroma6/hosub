from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message as MailMessage
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from sqlalchemy import text
from datetime import datetime
import cloudinary
import cloudinary.uploader
import os

cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
)

app = Flask(__name__)

CATEGORIES = {
    '담수어': ['구피', '코리·플래코', '디스커스', '베타', '중·대형어', '기타 열대어'],
    '해수어 & 산호': [],
    '수생 무척추동물': ['새우', '가재'],
    '파충류': ['거북이', '개구리'],
    '수초 & 식물': [],
}

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fish-market-secret-2024')
database_url = os.environ.get('DATABASE_URL', 'sqlite:///fish_market.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Flask-Mail 설정
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))

db = SQLAlchemy(app)
mail = Mail(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = '로그인이 필요합니다.'


# ── Token helpers ─────────────────────────────────────────

def generate_verification_token(email):
    s = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    return s.dumps(email, salt='email-verify')

def verify_token(token, expiration=3600):
    s = URLSafeTimedSerializer(app.config['SECRET_KEY'])
    try:
        email = s.loads(token, salt='email-verify', max_age=expiration)
    except (SignatureExpired, BadSignature):
        return None
    return email

def send_verification_email(user):
    token = generate_verification_token(user.email)
    verify_url = url_for('verify_email', token=token, _external=True)
    msg = MailMessage(
        subject='[AquaPet] 이메일 인증을 완료해주세요',
        recipients=[user.email],
        html=f'''
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2E75BF;">AquaPet 이메일 인증</h2>
          <p>안녕하세요, <strong>{user.username}</strong>님!</p>
          <p>아래 버튼을 클릭하면 이메일 인증이 완료되고 계정이 활성화됩니다.</p>
          <p style="margin: 28px 0;">
            <a href="{verify_url}"
               style="background:#4A90D9; color:white; padding:14px 28px;
                      border-radius:8px; text-decoration:none; font-weight:600;">
              이메일 인증하기
            </a>
          </p>
          <p style="color:#888; font-size:13px;">이 링크는 1시간 후 만료됩니다.</p>
          <p style="color:#888; font-size:13px;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
        </div>
        '''
    )
    mail.send(msg)


# ── Models ──────────────────────────────────────────────

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200))
    bank_name = db.Column(db.String(50))
    bank_account = db.Column(db.String(50))
    bio = db.Column(db.Text)
    is_admin = db.Column(db.Boolean, default=False)
    is_verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    fish_listings = db.relationship('Fish', backref='seller', lazy=True)


class Fish(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=False, server_default='담수어')
    species = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(300))
    weight = db.Column(db.String(50))
    quantity = db.Column(db.String(50))
    trade_type = db.Column(db.String(20), default='직거래')
    location = db.Column(db.String(100))
    status = db.Column(db.String(20), default='판매중')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    chat_rooms = db.relationship('ChatRoom', backref='fish', lazy=True, cascade='all, delete-orphan')
    images = db.relationship('FishImage', backref='fish_ref', lazy=True,
                             order_by='FishImage.order', cascade='all, delete-orphan')


class FishImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fish_id = db.Column(db.Integer, db.ForeignKey('fish.id'), nullable=False)
    image_url = db.Column(db.String(300), nullable=False)
    order = db.Column(db.Integer, default=0)


class ChatRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fish_id = db.Column(db.Integer, db.ForeignKey('fish.id'), nullable=False)
    buyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    seller_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    buyer = db.relationship('User', foreign_keys=[buyer_id])
    seller = db.relationship('User', foreign_keys=[seller_id])
    messages = db.relationship('Message', backref='room', lazy=True, order_by='Message.created_at', cascade='all, delete-orphan')


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
    category_filter = request.args.get('category', '')
    species_filter = request.args.get('species', '')
    search = request.args.get('search', '')

    query = Fish.query.filter_by(status='판매중')
    if category_filter:
        query = query.filter(Fish.category == category_filter)
    if species_filter:
        query = query.filter(Fish.species == species_filter)
    if search:
        query = query.filter(
            Fish.title.contains(search) | Fish.species.contains(search)
        )

    fish_list = query.order_by(Fish.created_at.desc()).all()

    return render_template('index.html', fish_list=fish_list, categories=CATEGORIES,
                           selected_category=category_filter, selected_species=species_filter,
                           search=search)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password_hash, password):
            if not user.is_verified:
                flash('이메일 인증이 필요합니다. 받은편지함을 확인해주세요.', 'error')
                return render_template('login.html', unverified_email=email)
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

        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password),
            is_verified=False,
        )
        db.session.add(user)
        db.session.commit()

        try:
            send_verification_email(user)
        except Exception as e:
            app.logger.error(f'Email send failed: {e}')
            flash('인증 이메일 발송에 실패했습니다. 잠시 후 재시도해주세요.', 'error')
            db.session.delete(user)
            db.session.commit()
            return render_template('register.html')

        return redirect(url_for('verify_pending', email=email))
    return render_template('register.html')


@app.route('/verify/pending')
def verify_pending():
    email = request.args.get('email', '')
    return render_template('verify_pending.html', email=email)


@app.route('/verify/<token>')
def verify_email(token):
    email = verify_token(token)
    if email is None:
        flash('인증 링크가 만료되었거나 유효하지 않습니다.', 'error')
        return redirect(url_for('login'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash('사용자를 찾을 수 없습니다.', 'error')
        return redirect(url_for('login'))

    if user.is_verified:
        flash('이미 인증된 계정입니다.', 'info')
        return redirect(url_for('login'))

    user.is_verified = True
    db.session.commit()
    flash('이메일 인증이 완료되었습니다! 로그인해주세요.', 'success')
    return redirect(url_for('login'))


@app.route('/verify/resend', methods=['POST'])
def resend_verification():
    email = request.form.get('email', '')
    user = User.query.filter_by(email=email).first()
    if user and not user.is_verified:
        try:
            send_verification_email(user)
            flash('인증 이메일을 다시 발송했습니다. 받은편지함을 확인해주세요.', 'success')
        except Exception:
            flash('이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error')
    else:
        flash('해당 이메일을 찾을 수 없거나 이미 인증된 계정입니다.', 'error')
    return redirect(url_for('verify_pending', email=email))


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


@app.route('/fish/new', methods=['GET', 'POST'])
@login_required
def fish_new():
    if request.method == 'POST':
        fish = Fish(
            seller_id=current_user.id,
            title=request.form.get('title'),
            category=request.form.get('category'),
            species=request.form.get('species'),
            price=int(request.form.get('price', 0)),
            description=request.form.get('description'),
            weight=request.form.get('weight'),
            quantity=request.form.get('quantity'),
            trade_type=request.form.get('trade_type', '직거래'),
            location=request.form.get('location'),
        )
        db.session.add(fish)
        db.session.flush()  # fish.id 확보

        files = request.files.getlist('images')
        for i, file in enumerate(files):
            if file.filename:
                result = cloudinary.uploader.upload(file, folder='aqua-market')
                url = result['secure_url']
                if i == 0:
                    fish.image_url = url  # 카드 썸네일용
                db.session.add(FishImage(fish_id=fish.id, image_url=url, order=i))

        db.session.commit()
        flash('판매 등록이 완료되었습니다!', 'success')
        return redirect(url_for('fish_detail', fish_id=fish.id))
    return render_template('fish_new.html', categories=CATEGORIES)


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
    if fish.seller_id != current_user.id and not current_user.is_admin:
        flash('권한이 없습니다.', 'error')
        return redirect(url_for('fish_detail', fish_id=fish_id))
    db.session.delete(fish)
    db.session.commit()
    flash('게시글이 삭제되었습니다.', 'success')
    if current_user.is_admin:
        return redirect(url_for('admin'))
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


@app.route('/seller/<int:user_id>')
def seller_profile(user_id):
    seller = User.query.get_or_404(user_id)
    listings = Fish.query.filter_by(seller_id=user_id, status='판매중').order_by(Fish.created_at.desc()).all()
    return render_template('seller_profile.html', seller=seller, listings=listings)


@app.route('/my')
@login_required
def my_page():
    my_listings = Fish.query.filter_by(seller_id=current_user.id).order_by(Fish.created_at.desc()).all()
    buy_rooms = ChatRoom.query.filter_by(buyer_id=current_user.id).all()
    sell_rooms = ChatRoom.query.filter_by(seller_id=current_user.id).all()
    return render_template('my_page.html', my_listings=my_listings,
                           buy_rooms=buy_rooms, sell_rooms=sell_rooms)


@app.route('/my/bio', methods=['POST'])
@login_required
def update_bio():
    current_user.bio = request.form.get('bio', '').strip()
    db.session.commit()
    flash('자기소개가 저장되었습니다.', 'success')
    return redirect(url_for('my_page'))


@app.route('/my/bank', methods=['POST'])
@login_required
def update_bank():
    current_user.bank_name = request.form.get('bank_name')
    current_user.bank_account = request.form.get('bank_account')
    db.session.commit()
    flash('계좌 정보가 저장되었습니다.', 'success')
    return redirect(url_for('my_page'))


@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('접근 권한이 없습니다.', 'error')
        return redirect(url_for('index'))
    all_fish = Fish.query.order_by(Fish.created_at.desc()).all()
    all_users = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin.html', all_fish=all_fish, all_users=all_users)


@app.route('/admin/user/<int:user_id>/delete', methods=['POST'])
@login_required
def admin_delete_user(user_id):
    if not current_user.is_admin:
        flash('접근 권한이 없습니다.', 'error')
        return redirect(url_for('index'))
    user = User.query.get_or_404(user_id)
    if user.is_admin:
        flash('관리자 계정은 삭제할 수 없습니다.', 'error')
        return redirect(url_for('admin'))
    db.session.delete(user)
    db.session.commit()
    flash(f'사용자 {user.username}이(가) 삭제되었습니다.', 'success')
    return redirect(url_for('admin'))


def seed_sample_data():
    if Fish.query.first():
        return

    demo_user = User.query.filter_by(email='demo@fishmarket.kr').first()
    if not demo_user:
        demo_user = User(
            username='피시마켓관리자',
            email='demo@fishmarket.kr',
            password_hash=generate_password_hash('demo1234'),
            bank_name='국민은행',
            bank_account='123-456-789012',
            is_verified=True,
        )
        db.session.add(demo_user)
        db.session.flush()

    samples = [
        dict(category='담수어', species='구피', title='고품질 구피 번식 쌍 분양합니다', price=15000,
             weight='5cm', location='서울 강남',
             description='건강하게 키운 풀레드 구피 쌍 분양입니다. 먹이 잘 먹고 활발해요.',
             image_url='https://images.unsplash.com/photo-1520302519878-dac5cbc76c78?w=600&q=80'),
        dict(category='담수어', species='베타', title='하프문 베타 수컷 분양', price=25000,
             weight='6cm', location='경기 수원',
             description='지느러미가 아름다운 하프문 베타입니다. 단독 사육 권장.',
             image_url='https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&q=80'),
        dict(category='담수어', species='디스커스', title='독일산 레드 디스커스 5인치', price=120000,
             weight='5인치', location='부산',
             description='독일 수입 레드 터콰이즈 디스커스입니다. 상태 최상.',
             image_url='https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&q=80'),
        dict(category='해수어 & 산호', species='해수어 & 산호', title='니모 흰동가리 한 쌍', price=45000,
             weight='4cm', location='인천',
             description='건강한 흰동가리 한 쌍입니다. 말미잘과 합사 가능.',
             image_url='https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80'),
        dict(category='수생 무척추동물', species='새우', title='체리 새우 10마리 분양', price=12000,
             weight='2cm', location='대전',
             description='선명한 레드 체리 새우 10마리입니다. 수초항에 최적.',
             image_url='https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=600&q=80'),
        dict(category='수초 & 식물', species='수초 & 식물', title='미크로소리움 대형 포기 분양', price=8000,
             weight=None, location='온라인 택배',
             description='수조에서 키운 건강한 미크로소리움 포기입니다. 저광에서도 잘 자라요.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
    ]

    for s in samples:
        db.session.add(Fish(seller_id=demo_user.id, status='판매중', **s))

    db.session.commit()


def run_migrations():
    with db.engine.connect() as conn:
        try:
            conn.execute(text(
                "ALTER TABLE fish ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT '담수어'"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                'ALTER TABLE "user" ADD COLUMN is_admin BOOLEAN DEFAULT FALSE'
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                "ALTER TABLE fish ADD COLUMN quantity VARCHAR(50)"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                "ALTER TABLE fish ADD COLUMN trade_type VARCHAR(20) DEFAULT '직거래'"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text('ALTER TABLE "user" ADD COLUMN bio TEXT'))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                'ALTER TABLE "user" ADD COLUMN is_verified BOOLEAN DEFAULT FALSE'
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        # 기존 사용자(이미 가입된)는 인증된 것으로 처리
        try:
            conn.execute(text(
                'UPDATE "user" SET is_verified = TRUE WHERE is_verified IS NULL OR is_verified = FALSE AND created_at < NOW() - INTERVAL \'1 day\''
            ))
            conn.commit()
        except Exception:
            conn.rollback()


def seed_fish_images():
    if FishImage.query.first():
        return
    # 구피 게시물에 여러 장 샘플 추가
    guppy = Fish.query.filter_by(species='구피').first()
    if guppy:
        sample_urls = [
            'https://images.unsplash.com/photo-1520302519878-dac5cbc76c78?w=600&q=80',
            'https://images.unsplash.com/photo-1571752726703-5e7d1f6a986d?w=600&q=80',
            'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=600&q=80',
        ]
        for i, url in enumerate(sample_urls):
            db.session.add(FishImage(fish_id=guppy.id, image_url=url, order=i))
        db.session.commit()


def seed_admin_user():
    admin = User.query.filter_by(email='joms0907@naver.com').first()
    if not admin:
        admin = User(
            username='관리자',
            email='joms0907@naver.com',
            password_hash=generate_password_hash('Khakis0403!@#$'),
            is_admin=True,
            is_verified=True,
        )
        db.session.add(admin)
        db.session.commit()
    else:
        changed = False
        if not admin.is_admin:
            admin.is_admin = True
            changed = True
        if not admin.is_verified:
            admin.is_verified = True
            changed = True
        if changed:
            db.session.commit()


with app.app_context():
    db.create_all()
    run_migrations()
    seed_sample_data()
    seed_fish_images()
    seed_admin_user()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
