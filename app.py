from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Database Model ---
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.String(20), nullable=False)
    end_date = db.Column(db.String(20), nullable=True)
    color = db.Column(db.String(20), default='#3788d8')

# Initialize DB
with app.app_context():
    db.create_all()

# --- Main Route ---
@app.route('/')
def index():
    return render_template('index.html')

# --- API Routes ---

@app.route('/api/events', methods=['GET'])
def get_events():
    events = Event.query.all()
    event_list = []
    for event in events:
        event_list.append({
            "id": event.id,
            "title": event.title,
            "start": event.start_date,
            "end": event.end_date,
            "backgroundColor": event.color,
            "borderColor": event.color,
            "allDay": len(event.start_date) == 10 
        })
    return jsonify(event_list)

@app.route('/api/events', methods=['POST'])
def add_event():
    data = request.json
    new_event = Event(
        title=data['title'],
        start_date=data['start'],
        end_date=data.get('end'),
        color=data['backgroundColor']
    )
    db.session.add(new_event)
    db.session.commit()
    return jsonify({"status": "success", "message": "Event saved!"})

@app.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    event = db.session.get(Event, event_id)
    if event:
        data = request.json
        if 'start' in data: event.start_date = data['start']
        if 'end' in data: event.end_date = data['end']
        if 'title' in data: event.title = data['title']
        if 'backgroundColor' in data: event.color = data['backgroundColor']
        db.session.commit()
        return jsonify({"message": "Event updated successfully"})
    return jsonify({"message": "Event not found"}), 404

@app.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = db.session.get(Event, event_id)
    if event:
        db.session.delete(event)
        db.session.commit()
        return jsonify({"message": "Event deleted successfully"})
    return jsonify({"message": "Event not found"}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)