from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message as MailMessage
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from sqlalchemy import text, func
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

FISH_TYPES = ['담수어', '해수어', '산호', '파충류', '수초 & 식물']
GENDERS = ['수컷', '암컷', '미구분']
REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
           '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']

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

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', app.config['SECRET_KEY'])
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = __import__('datetime').timedelta(days=30)

db = SQLAlchemy(app)
mail = Mail(app)
jwt = JWTManager(app)
CORS(app)
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
    gender = db.Column(db.String(10), default='미구분')
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
    buyer_hidden = db.Column(db.Boolean, default=False)
    seller_hidden = db.Column(db.Boolean, default=False)

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


class Wishlist(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    fish_id = db.Column(db.Integer, db.ForeignKey('fish.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint('user_id', 'fish_id'), {})


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


# ── Routes ──────────────────────────────────────────────

@app.route('/')
def index():
    fish_type   = request.args.get('fish_type', '')
    gender      = request.args.get('gender', '')
    price_min   = request.args.get('price_min', '')
    price_max   = request.args.get('price_max', '')
    region      = request.args.get('region', '')
    search      = request.args.get('search', '')
    sort        = request.args.get('sort', 'newest')

    query = Fish.query.filter_by(status='판매중')
    if fish_type:
        query = query.filter(Fish.category == fish_type)
    if gender:
        query = query.filter(Fish.gender == gender)
    if price_min:
        query = query.filter(Fish.price >= int(price_min))
    if price_max:
        query = query.filter(Fish.price <= int(price_max))
    if region:
        query = query.filter(Fish.location.contains(region))
    if search:
        query = query.filter(
            Fish.title.contains(search) | Fish.species.contains(search)
        )

    fish_list = _apply_sort(query, sort).all()

    return render_template('index.html', fish_list=fish_list,
                           fish_types=FISH_TYPES, genders=GENDERS, regions=REGIONS,
                           fish_type=fish_type, gender=gender,
                           price_min=price_min, price_max=price_max,
                           region=region, search=search, sort=sort)


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
            species=request.form.get('species', ''),
            gender=request.form.get('gender', '미구분'),
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
    return render_template('fish_new.html', fish_types=FISH_TYPES, genders=GENDERS, regions=REGIONS)


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
    demo_user = User.query.filter_by(email='demo@fishmarket.kr').first()
    if not demo_user:
        demo_user = User(
            username='AquaPet관리자',
            email='demo@fishmarket.kr',
            password_hash=generate_password_hash('demo1234'),
            is_verified=True,
        )
        db.session.add(demo_user)
        db.session.flush()

    existing_titles = {f.title for f in Fish.query.filter_by(seller_id=demo_user.id).all()}

    samples = [
        # ── 담수어 10개 ──
        dict(category='담수어', species='구피', gender='수컷', title='풀레드 구피 수컷 5마리 분양', price=12000,
             weight='4cm', quantity='5', trade_type='택배', location='서울 강남',
             description='선명한 풀레드 발색의 구피 수컷입니다. 먹이 반응 좋고 활발해요.',
             image_url='https://images.unsplash.com/photo-1520302519878-dac5cbc76c78?w=600&q=80'),
        dict(category='담수어', species='구피', gender='혼합', title='모자이크 구피 번식쌍 분양', price=18000,
             weight='4cm', quantity='2', trade_type='직거래', location='경기 성남',
             description='모자이크 패턴의 구피 번식쌍입니다. 이미 포란 상태입니다.',
             image_url='https://images.unsplash.com/photo-1520302519878-dac5cbc76c78?w=600&q=80'),
        dict(category='담수어', species='베타', gender='수컷', title='하프문 베타 수컷 분양', price=25000,
             weight='6cm', quantity='1', trade_type='택배', location='경기 수원',
             description='지느러미가 화려한 하프문 베타 수컷입니다. 단독 사육 권장.',
             image_url='https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&q=80'),
        dict(category='담수어', species='베타', gender='암컷', title='크라운테일 베타 암컷 분양', price=15000,
             weight='5cm', quantity='1', trade_type='택배', location='서울 마포',
             description='진한 레드 색상의 크라운테일 베타 암컷입니다. 건강 상태 좋습니다.',
             image_url='https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&q=80'),
        dict(category='담수어', species='디스커스', gender='미구분', title='레드 터콰이즈 디스커스 5인치', price=120000,
             weight='5인치', quantity='1', trade_type='직거래', location='부산 해운대',
             description='독일 혈통의 레드 터콰이즈 디스커스입니다. 발색 최상급.',
             image_url='https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&q=80'),
        dict(category='담수어', species='디스커스', gender='미구분', title='블루 다이아몬드 디스커스 4인치', price=90000,
             weight='4인치', quantity='1', trade_type='직거래', location='대구',
             description='블루 다이아몬드 디스커스입니다. 먹이 잘 먹고 성격 온순.',
             image_url='https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&q=80'),
        dict(category='담수어', species='코리도라스', gender='미구분', title='줄리 코리도라스 6마리', price=20000,
             weight='3cm', quantity='6', trade_type='택배', location='인천 부평',
             description='얌전하고 바닥 청소 능력이 탁월한 줄리 코리도라스입니다.',
             image_url='https://images.unsplash.com/photo-1560275619-4cc5fa59d3ae?w=600&q=80'),
        dict(category='담수어', species='플래코', gender='미구분', title='레몬 플래코 분양', price=35000,
             weight='8cm', quantity='1', trade_type='직거래', location='광주',
             description='노란색 몸통이 예쁜 레몬 플래코입니다. 이끼 제거 능력 우수.',
             image_url='https://images.unsplash.com/photo-1560275619-4cc5fa59d3ae?w=600&q=80'),
        dict(category='담수어', species='엔젤피쉬', gender='미구분', title='마블 엔젤피쉬 대형 분양', price=30000,
             weight='10cm', quantity='1', trade_type='직거래', location='울산',
             description='마블 패턴의 대형 엔젤피쉬입니다. 우아한 자태가 매력적입니다.',
             image_url='https://images.unsplash.com/photo-1535591273668-578e31182c4f?w=600&q=80'),
        dict(category='담수어', species='금붕어', gender='미구분', title='오란다 금붕어 분양', price=22000,
             weight='12cm', quantity='1', trade_type='직거래', location='서울 송파',
             description='볼록한 머리혹이 특징인 오란다 금붕어입니다. 건강하고 식욕 왕성.',
             image_url='https://images.unsplash.com/photo-1520302519878-dac5cbc76c78?w=600&q=80'),

        # ── 해수어 10개 ──
        dict(category='해수어', species='흰동가리', gender='혼합', title='퍼큘라 흰동가리 한 쌍 분양', price=45000,
             weight='4cm', quantity='2', trade_type='직거래', location='인천 연수',
             description='건강한 퍼큘라 흰동가리 한 쌍입니다. 말미잘과 합사 가능.',
             image_url='https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80'),
        dict(category='해수어', species='흰동가리', gender='수컷', title='블랙 오셀라리스 흰동가리', price=55000,
             weight='5cm', quantity='1', trade_type='직거래', location='부산 수영',
             description='희귀한 블랙 오셀라리스 품종입니다. 상태 매우 좋습니다.',
             image_url='https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80'),
        dict(category='해수어', species='블루탱', gender='미구분', title='팔레트 서전피쉬(블루탱) 분양', price=80000,
             weight='7cm', quantity='1', trade_type='직거래', location='경기 안양',
             description='선명한 파란색의 팔레트 서전피쉬입니다. 건강 상태 최상.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='나비고기', gender='미구분', title='롱핀 나비고기 분양', price=60000,
             weight='6cm', quantity='1', trade_type='직거래', location='서울 강서',
             description='긴 지느러미가 우아한 롱핀 나비고기입니다. 먹이 잘 먹어요.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='앤젤피쉬', gender='미구분', title='코럴 뷰티 앤젤 분양', price=75000,
             weight='7cm', quantity='1', trade_type='직거래', location='대전 유성',
             description='보랏빛과 오렌지빛이 조화로운 코럴 뷰티 앤젤입니다.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='앤젤피쉬', gender='미구분', title='플레임 앤젤피쉬 분양', price=85000,
             weight='6cm', quantity='1', trade_type='직거래', location='경기 고양',
             description='불꽃처럼 붉은 플레임 앤젤입니다. 산호 수조 합사 주의.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='만다린피쉬', gender='수컷', title='만다린 드래곤 수컷 분양', price=95000,
             weight='5cm', quantity='1', trade_type='직거래', location='서울 강동',
             description='화려한 패턴의 만다린 드래곤입니다. 라이브 푸드 급이 중.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='크로미스', gender='미구분', title='그린 크로미스 5마리 분양', price=30000,
             weight='4cm', quantity='5', trade_type='택배', location='경남 창원',
             description='에메랄드빛 그린 크로미스 5마리입니다. 무난한 해수어 입문종.',
             image_url='https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=600&q=80'),
        dict(category='해수어', species='그루퍼', gender='미구분', title='미니 레드 그루퍼 분양', price=65000,
             weight='8cm', quantity='1', trade_type='직거래', location='부산 기장',
             description='빨간 몸통이 인상적인 미니 그루퍼입니다. 성격은 온순한 편.',
             image_url='https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80'),
        dict(category='해수어', species='라이온피쉬', gender='미구분', title='드워프 라이온피쉬 분양', price=70000,
             weight='9cm', quantity='1', trade_type='직거래', location='인천 남동',
             description='독이 있으므로 취급 주의. 관리만 잘 하면 훌륭한 관상어입니다.',
             image_url='https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&q=80'),

        # ── 산호 10개 ──
        dict(category='산호', species='LPS산호', gender='미구분', title='메탈릭 그린 아크로포라 분양', price=40000,
             weight=None, quantity='1', trade_type='직거래', location='서울 강남',
             description='형광 그린 발색의 아크로포라입니다. 강한 조명과 높은 수류 필요.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='소프트산호', gender='미구분', title='버섯 산호 모음 분양', price=25000,
             weight=None, quantity='5', trade_type='택배', location='경기 화성',
             description='다양한 색상의 버섯 산호 5개 모음입니다. 키우기 쉬운 입문종.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='소프트산호', gender='미구분', title='가죽 산호 대형 분양', price=30000,
             weight=None, quantity='1', trade_type='직거래', location='부산 남구',
             description='쭉쭉 뻗는 가죽 산호 대형 개체입니다. 저광에서도 잘 자람.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='LPS산호', gender='미구분', title='브레인 산호 분양', price=55000,
             weight=None, quantity='1', trade_type='직거래', location='인천 계양',
             description='뇌처럼 생긴 독특한 브레인 산호입니다. 굵은 유로가 매력.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='SPS산호', gender='미구분', title='스타폴립 군락 분양', price=20000,
             weight=None, quantity='1', trade_type='택배', location='경기 시흥',
             description='빠르게 퍼지는 스타폴립 군락입니다. 초보자에게 추천.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='소프트산호', gender='미구분', title='콜트 산호 분양', price=18000,
             weight=None, quantity='1', trade_type='택배', location='대전 대덕',
             description='부드럽게 흔들리는 콜트 산호입니다. 성장이 빠르고 관리 쉬움.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='LPS산호', gender='미구분', title='도너츠 산호(블라스토) 분양', price=45000,
             weight=None, quantity='1', trade_type='직거래', location='서울 용산',
             description='원형 폴립이 예쁜 블라스토뮤사 산호입니다. 색상 선명.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='소프트산호', gender='미구분', title='리더 산호 분양', price=22000,
             weight=None, quantity='2', trade_type='택배', location='경남 김해',
             description='활짝 피면 아름다운 리더 산호 2개 분양합니다.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='SPS산호', gender='미구분', title='포코로포라 SPS 산호 분양', price=60000,
             weight=None, quantity='1', trade_type='직거래', location='경기 파주',
             description='고급 SPS 포코로포라입니다. 강한 수류와 높은 수질 필요.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),
        dict(category='산호', species='LPS산호', gender='미구분', title='골든 토치 산호 분양', price=50000,
             weight=None, quantity='1', trade_type='직거래', location='서울 노원',
             description='황금빛 폴립이 화려한 토치 산호입니다. LPS 중 인기 종.',
             image_url='https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&q=80'),

        # ── 파충류 10개 ──
        dict(category='파충류', species='거북이', gender='미구분', title='붉은귀 거북 중형 분양', price=20000,
             weight='15cm', quantity='1', trade_type='직거래', location='서울 은평',
             description='건강하게 키운 붉은귀 거북이입니다. 먹이 반응 매우 좋아요.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='거북이', gender='수컷', title='남생이 수컷 분양', price=150000,
             weight='18cm', quantity='1', trade_type='직거래', location='경기 의정부',
             description='천연기념물 남생이 합법 개체입니다. 서류 완비.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='개구리', gender='미구분', title='팩맨 개구리 분양', price=35000,
             weight='8cm', quantity='1', trade_type='택배', location='부산 동구',
             description='동그랗고 귀여운 팩맨 개구리입니다. 먹이 잘 먹고 건강.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='개구리', gender='미구분', title='뿔개구리 알비노 분양', price=55000,
             weight='7cm', quantity='1', trade_type='택배', location='인천 서구',
             description='희귀한 알비노 뿔개구리입니다. 노란빛 몸통이 매력적.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='레오파드게코', gender='수컷', title='레오파드 게코 수컷 분양', price=80000,
             weight='20cm', quantity='1', trade_type='직거래', location='서울 관악',
             description='탱글한 꼬리를 가진 레오파드 게코 수컷입니다. 핸들링 익숙.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='크레스티드게코', gender='암컷', title='크레스티드 게코 암컷 분양', price=90000,
             weight='18cm', quantity='1', trade_type='택배', location='경기 부천',
             description='도마뱀 초보자에게 추천하는 크레스티드 게코입니다.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='카멜레온', gender='수컷', title='베일드 카멜레온 수컷 분양', price=200000,
             weight='35cm', quantity='1', trade_type='직거래', location='서울 동대문',
             description='성체 베일드 카멜레온 수컷입니다. 특유의 색 변화가 장관.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='도마뱀', gender='미구분', title='블루텅 스킨크 분양', price=120000,
             weight='40cm', quantity='1', trade_type='직거래', location='대구 달서',
             description='파란 혀가 특징인 블루텅 스킨크입니다. 성격 순해서 핸들링 쉬움.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='거북이', gender='암컷', title='다이아몬드백 테라핀 암컷', price=180000,
             weight='20cm', quantity='1', trade_type='직거래', location='경기 수원',
             description='등껍질 패턴이 아름다운 다이아몬드백 테라핀 성체입니다.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),
        dict(category='파충류', species='청개구리', gender='미구분', title='청개구리 5마리 분양', price=15000,
             weight='4cm', quantity='5', trade_type='택배', location='강원 춘천',
             description='자연에서 채집한 건강한 청개구리 5마리입니다. 관리 쉬움.',
             image_url='https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600&q=80'),

        # ── 수초 & 식물 10개 ──
        dict(category='수초 & 식물', species='수초', gender='미구분', title='모스볼 대형 분양', price=8000,
             weight=None, quantity='1', trade_type='택배', location='경기 용인',
             description='둥글둥글 귀여운 모스볼 대형입니다. 저광에서도 잘 자라요.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='크립토코리네 모음 5종 분양', price=15000,
             weight=None, quantity='5', trade_type='택배', location='서울 성북',
             description='다양한 크립토코리네 5종 모음입니다. 저광 환경에서도 잘 자람.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='로탈라 로툰디폴리아 분양', price=5000,
             weight=None, quantity='10', trade_type='택배', location='경기 안산',
             description='선홍빛 발색의 로탈라 로툰디폴리아 줄기 10본 분양.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='미크로소리움 대형 포기 분양', price=12000,
             weight=None, quantity='1', trade_type='택배', location='온라인 택배',
             description='저광에서도 잘 자라는 미크로소리움 대형 포기입니다.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='자바 모스 클램프 분양', price=6000,
             weight=None, quantity='3', trade_type='택배', location='인천 부평',
             description='유목에 붙은 자바 모스 클램프입니다. 새우항에 최적.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='발리스네리아 스피랄리스 분양', price=4000,
             weight=None, quantity='10', trade_type='택배', location='경기 평택',
             description='긴 잎이 흔들리는 발리스네리아입니다. 번식력이 왕성해요.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='아마존 소드 대형 분양', price=10000,
             weight=None, quantity='1', trade_type='직거래', location='서울 중랑',
             description='넓은 잎이 인상적인 아마존 소드 대형 개체입니다.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='아누비아스 나나 포기 분양', price=9000,
             weight=None, quantity='2', trade_type='택배', location='경기 김포',
             description='유목 부착용 아누비아스 나나 2포기입니다. 관리 매우 쉬움.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='수초', gender='미구분', title='부세팔란드라 sp. 그린 분양', price=18000,
             weight=None, quantity='1', trade_type='택배', location='서울 강북',
             description='반짝이는 잎이 특징인 부세팔란드라입니다. 희귀 수초.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
        dict(category='수초 & 식물', species='반수생식물', gender='미구분', title='워터 히아신스 모종 분양', price=5000,
             weight=None, quantity='3', trade_type='택배', location='전남 나주',
             description='자연 정화 능력이 뛰어난 워터 히아신스 모종 3개입니다.',
             image_url='https://images.unsplash.com/photo-1520301255226-bf5f144451c1?w=600&q=80'),
    ]

    added = 0
    for s in samples:
        if s['title'] not in existing_titles:
            db.session.add(Fish(seller_id=demo_user.id, status='판매중', **s))
            added += 1
    if added:
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
        try:
            conn.execute(text(
                "ALTER TABLE fish ADD COLUMN gender VARCHAR(10) DEFAULT '미구분'"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                "ALTER TABLE fish ALTER COLUMN species DROP NOT NULL"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                "ALTER TABLE fish ALTER COLUMN species SET DEFAULT ''"
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                'ALTER TABLE chat_room ADD COLUMN buyer_hidden BOOLEAN DEFAULT FALSE'
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text(
                'ALTER TABLE chat_room ADD COLUMN seller_hidden BOOLEAN DEFAULT FALSE'
            ))
            conn.commit()
        except Exception:
            conn.rollback()
        try:
            conn.execute(text('''
                CREATE TABLE IF NOT EXISTS wishlist (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES "user"(id),
                    fish_id INTEGER NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(user_id, fish_id)
                )
            '''))
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


# ── API helpers ─────────────────────────────────────────────

def fish_to_dict(f, detail=False):
    imgs = [img.image_url for img in f.images]
    if not imgs and f.image_url:
        imgs = [f.image_url]
    d = {
        'id': f.id,
        'title': f.title,
        'category': f.category,
        'species': f.species,
        'price': f.price,
        'image_url': imgs[0] if imgs else None,
        'images': imgs,
        'gender': f.gender or '미구분',
        'weight': f.weight or '',
        'quantity': f.quantity or '',
        'trade_type': f.trade_type or '',
        'location': f.location or '',
        'status': f.status,
        'created_at': f.created_at.strftime('%Y년 %m월 %d일'),
        'seller': {'id': f.seller.id, 'username': f.seller.username},
    }
    if detail:
        d['description'] = f.description or ''
    return d


def room_to_dict(r, user_id):
    partner = r.seller if r.buyer_id == user_id else r.buyer
    imgs = [img.image_url for img in r.fish.images]
    last_msg = r.messages[-1] if r.messages else None
    return {
        'id': r.id,
        'fish': {
            'id': r.fish.id,
            'title': r.fish.title,
            'price': r.fish.price,
            'image_url': imgs[0] if imgs else (r.fish.image_url or ''),
        },
        'partner': {'id': partner.id, 'username': partner.username},
        'last_message': last_msg.content if last_msg else '',
        'last_at': last_msg.created_at.strftime('%H:%M') if last_msg else '',
    }


# ── API Routes ───────────────────────────────────────────────

@app.route('/api/categories')
def api_categories():
    return jsonify({'fish_types': FISH_TYPES, 'genders': GENDERS, 'regions': REGIONS})


@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get('email')).first()
    if not user or not check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
    if not user.is_verified:
        return jsonify({'error': '이메일 인증이 필요합니다.'}), 403
    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': {'id': user.id, 'username': user.username, 'email': user.email}})


@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    if User.query.filter_by(email=email).first():
        return jsonify({'error': '이미 사용 중인 이메일입니다.'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': '이미 사용 중인 닉네임입니다.'}), 400
    user = User(username=username, email=email,
                password_hash=generate_password_hash(password), is_verified=False)
    db.session.add(user)
    db.session.commit()
    try:
        send_verification_email(user)
    except Exception:
        db.session.delete(user)
        db.session.commit()
        return jsonify({'error': '인증 이메일 발송에 실패했습니다.'}), 500
    return jsonify({'message': '인증 이메일을 발송했습니다. 이메일을 확인해주세요.'}), 201


def _apply_sort(query, sort):
    if sort == 'popular':
        wc = db.session.query(
            Wishlist.fish_id,
            func.count(Wishlist.id).label('wc')
        ).group_by(Wishlist.fish_id).subquery()
        query = query.outerjoin(wc, Fish.id == wc.c.fish_id)
        query = query.order_by(func.coalesce(wc.c.wc, 0).desc(), Fish.created_at.desc())
    else:
        query = query.order_by(Fish.created_at.desc())
    return query


@app.route('/api/fish')
def api_fish_list():
    fish_type  = request.args.get('fish_type', '')
    gender     = request.args.get('gender', '')
    price_min  = request.args.get('price_min', '')
    price_max  = request.args.get('price_max', '')
    region     = request.args.get('region', '')
    search     = request.args.get('search', '')
    sort       = request.args.get('sort', 'newest')
    query = Fish.query.filter_by(status='판매중')
    if fish_type:
        query = query.filter(Fish.category == fish_type)
    if gender:
        query = query.filter(Fish.gender == gender)
    if price_min:
        query = query.filter(Fish.price >= int(price_min))
    if price_max:
        query = query.filter(Fish.price <= int(price_max))
    if region:
        query = query.filter(Fish.location.contains(region))
    if search:
        query = query.filter(Fish.title.contains(search) | Fish.species.contains(search))
    fish_list = _apply_sort(query, sort).all()
    return jsonify([fish_to_dict(f) for f in fish_list])


@app.route('/api/fish/<int:fish_id>')
def api_fish_detail(fish_id):
    fish = Fish.query.get_or_404(fish_id)
    return jsonify(fish_to_dict(fish, detail=True))


@app.route('/api/fish', methods=['POST'])
@jwt_required()
def api_fish_new():
    user_id = int(get_jwt_identity())
    fish = Fish(
        seller_id=user_id,
        title=request.form.get('title'),
        category=request.form.get('category'),
        species=request.form.get('species', ''),
        gender=request.form.get('gender', '미구분'),
        price=int(request.form.get('price', 0)),
        description=request.form.get('description', ''),
        weight=request.form.get('weight', ''),
        quantity=request.form.get('quantity', ''),
        trade_type=request.form.get('trade_type', '직거래'),
        location=request.form.get('location', ''),
    )
    db.session.add(fish)
    db.session.flush()
    files = request.files.getlist('images')
    for i, file in enumerate(files):
        if file.filename:
            result = cloudinary.uploader.upload(file, folder='aqua-market')
            url = result['secure_url']
            if i == 0:
                fish.image_url = url
            db.session.add(FishImage(fish_id=fish.id, image_url=url, order=i))
    db.session.commit()
    return jsonify(fish_to_dict(fish, detail=True)), 201


@app.route('/api/fish/<int:fish_id>', methods=['DELETE'])
@jwt_required()
def api_fish_delete(fish_id):
    user_id = int(get_jwt_identity())
    fish = Fish.query.get_or_404(fish_id)
    user = db.session.get(User, user_id)
    if fish.seller_id != user_id and not user.is_admin:
        return jsonify({'error': '권한이 없습니다.'}), 403
    db.session.delete(fish)
    db.session.commit()
    return jsonify({'message': '삭제되었습니다.'})


@app.route('/api/fish/<int:fish_id>/status', methods=['PATCH'])
@jwt_required()
def api_update_status(fish_id):
    user_id = int(get_jwt_identity())
    fish = Fish.query.get_or_404(fish_id)
    if fish.seller_id != user_id:
        return jsonify({'error': '권한이 없습니다.'}), 403
    status = request.get_json().get('status')
    if status in ['판매중', '예약중', '판매완료']:
        fish.status = status
        db.session.commit()
    return jsonify({'status': fish.status})


@app.route('/api/seller/<int:user_id>')
def api_seller_profile(user_id):
    seller = User.query.get_or_404(user_id)
    listings = Fish.query.filter_by(seller_id=user_id, status='판매중').order_by(Fish.created_at.desc()).all()
    return jsonify({
        'id': seller.id,
        'username': seller.username,
        'bio': seller.bio or '',
        'listings': [fish_to_dict(f) for f in listings],
    })


@app.route('/api/me')
@jwt_required()
def api_me():
    user = db.session.get(User, int(get_jwt_identity()))
    return jsonify({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'bio': user.bio or '',
        'bank_name': user.bank_name or '',
        'bank_account': user.bank_account or '',
        'is_admin': user.is_admin,
    })


@app.route('/api/me/bio', methods=['PATCH'])
@jwt_required()
def api_update_bio():
    user = db.session.get(User, int(get_jwt_identity()))
    user.bio = request.get_json().get('bio', '').strip()
    db.session.commit()
    return jsonify({'bio': user.bio})


@app.route('/api/me/bank', methods=['PATCH'])
@jwt_required()
def api_update_bank():
    user = db.session.get(User, int(get_jwt_identity()))
    data = request.get_json()
    user.bank_name    = data.get('bank_name', '')
    user.bank_account = data.get('bank_account', '')
    db.session.commit()
    return jsonify({'bank_name': user.bank_name, 'bank_account': user.bank_account})


@app.route('/api/me/listings')
@jwt_required()
def api_my_listings():
    user_id = int(get_jwt_identity())
    listings = Fish.query.filter_by(seller_id=user_id).order_by(Fish.created_at.desc()).all()
    return jsonify([fish_to_dict(f) for f in listings])


@app.route('/api/chat')
@jwt_required()
def api_chat_list():
    user_id = int(get_jwt_identity())
    buy_rooms  = ChatRoom.query.filter_by(buyer_id=user_id,  buyer_hidden=False).all()
    sell_rooms = ChatRoom.query.filter_by(seller_id=user_id, seller_hidden=False).all()
    return jsonify([room_to_dict(r, user_id) for r in buy_rooms + sell_rooms])


@app.route('/api/chat/<int:room_id>/hide', methods=['PATCH'])
@jwt_required()
def api_chat_hide(room_id):
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get_or_404(room_id)
    if room.buyer_id == user_id:
        room.buyer_hidden = True
    elif room.seller_id == user_id:
        room.seller_hidden = True
    else:
        return jsonify({'error': '권한이 없습니다.'}), 403
    db.session.commit()
    return jsonify({'hidden': True})


@app.route('/api/chat/start/<int:fish_id>', methods=['POST'])
@jwt_required()
def api_start_chat(fish_id):
    user_id = int(get_jwt_identity())
    fish = Fish.query.get_or_404(fish_id)
    if fish.seller_id == user_id:
        return jsonify({'error': '본인 게시물에는 채팅을 시작할 수 없습니다.'}), 400
    room = ChatRoom.query.filter_by(fish_id=fish_id, buyer_id=user_id).first()
    if not room:
        room = ChatRoom(fish_id=fish_id, buyer_id=user_id, seller_id=fish.seller_id)
        db.session.add(room)
        db.session.commit()
    return jsonify({'room_id': room.id})


@app.route('/api/chat/<int:room_id>/messages')
@jwt_required()
def api_get_messages(room_id):
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get_or_404(room_id)
    if user_id not in [room.buyer_id, room.seller_id]:
        return jsonify({'error': '권한이 없습니다.'}), 403
    last_id = request.args.get('last_id', 0, type=int)
    messages = Message.query.filter(
        Message.room_id == room_id, Message.id > last_id
    ).order_by(Message.created_at).all()
    return jsonify([{
        'id': m.id,
        'content': m.content,
        'sender': m.sender.username,
        'is_mine': m.sender_id == user_id,
        'created_at': m.created_at.strftime('%H:%M'),
    } for m in messages])


@app.route('/api/chat/<int:room_id>/send', methods=['POST'])
@jwt_required()
def api_send_message(room_id):
    user_id = int(get_jwt_identity())
    room = ChatRoom.query.get_or_404(room_id)
    if user_id not in [room.buyer_id, room.seller_id]:
        return jsonify({'error': '권한이 없습니다.'}), 403
    content = request.get_json().get('content', '').strip()
    if not content:
        return jsonify({'error': '메시지 내용이 없습니다.'}), 400
    message = Message(room_id=room_id, sender_id=user_id, content=content)
    db.session.add(message)
    db.session.commit()
    return jsonify({
        'id': message.id,
        'content': message.content,
        'sender': message.sender.username,
        'is_mine': True,
        'created_at': message.created_at.strftime('%H:%M'),
    })


# ── Wishlist API ──────────────────────────────────────────────

@app.route('/api/wishlist', methods=['GET'])
@jwt_required()
def api_wishlist_list():
    user_id = int(get_jwt_identity())
    items = Wishlist.query.filter_by(user_id=user_id).order_by(Wishlist.created_at.desc()).all()
    fish_ids = [w.fish_id for w in items]
    if not fish_ids:
        return jsonify([])
    fish_map = {f.id: f for f in Fish.query.filter(Fish.id.in_(fish_ids)).all()}
    result = [fish_to_dict(fish_map[fid]) for fid in fish_ids if fid in fish_map]
    return jsonify(result)


@app.route('/api/wishlist/<int:fish_id>', methods=['POST'])
@jwt_required()
def api_wishlist_toggle(fish_id):
    try:
        user_id = int(get_jwt_identity())
        fish = db.session.get(Fish, fish_id)
        if not fish:
            return jsonify({'error': '상품을 찾을 수 없습니다.'}), 404
        existing = Wishlist.query.filter_by(user_id=user_id, fish_id=fish_id).first()
        if existing:
            db.session.delete(existing)
            db.session.commit()
            return jsonify({'wishlisted': False})
        db.session.add(Wishlist(user_id=user_id, fish_id=fish_id))
        db.session.commit()
        return jsonify({'wishlisted': True})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f'Wishlist toggle error fish_id={fish_id}: {e}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/wishlist/<int:fish_id>/check')
@jwt_required()
def api_wishlist_check(fish_id):
    user_id = int(get_jwt_identity())
    exists = Wishlist.query.filter_by(user_id=user_id, fish_id=fish_id).first()
    return jsonify({'wishlisted': bool(exists)})


with app.app_context():
    db.create_all()
    run_migrations()
    seed_sample_data()
    seed_fish_images()
    seed_admin_user()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
