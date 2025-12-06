document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    
    // 1. Load User Preferences
    const savedTimeFormat = localStorage.getItem('timeFormat') || '12';
    const savedWeekStart = localStorage.getItem('weekStart') || '0';
    const savedDateFormat = localStorage.getItem('dateFormat') || 'YYYY-MM-DD';
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedView = localStorage.getItem('currentView') || 'dayGridMonth';

    // Apply Dark Mode immediately if saved
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-bs-theme', 'dark');
        document.getElementById('darkModeSwitch').checked = true;
    }

    // Configure Time Format (12h vs 24h)
    const hour12Setting = savedTimeFormat === '12';
    const slotLabelFormat = hour12Setting 
        ? { hour: 'numeric', minute: '2-digit', meridiem: 'short' } 
        : { hour: '2-digit', minute: '2-digit', hour12: false };

    // 2. Initialize FullCalendar
    window.calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: savedView,
        firstDay: parseInt(savedWeekStart),
        slotLabelFormat: slotLabelFormat,
        eventTimeFormat: slotLabelFormat,
        nextDayThreshold: '09:00:00', // Prevents late night events from spanning two days
        defaultTimedEventDuration: '01:00:00', 

        // Apply specific class to Deadlines for CSS styling
        eventClassNames: function(arg) {
            if (arg.event.backgroundColor === '#dc3545') {
                return [ 'deadline-event' ];
            }
            return [];
        },
        
        headerToolbar: {
            left: 'prev,next today', 
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek' 
        },
        height: 'auto',
        events: '/api/events',
        editable: true,
        selectable: true,

        // Save view state on change
        datesSet: function(info) {
            localStorage.setItem('currentView', info.view.type);
        },

        // --- Drag & Drop Handler ---
        eventDrop: function(info) {
            const updates = { start: info.event.start.toISOString() };
            if (info.event.end) updates.end = info.event.end.toISOString();
            
            if (info.event.allDay) {
                updates.start = updates.start.split('T')[0];
                updates.end = null;
            }

            fetch(`/api/events/${info.event.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
        },

        // --- Click Handler (View Details) ---
        eventClick: function(info) {
            const eventObj = info.event;
            document.getElementById('viewEventTitle').innerText = eventObj.title;
            const isoDate = eventObj.start.toISOString().split('T')[0];
            const dateStr = formatDisplayDate(isoDate, savedDateFormat);

            let displayStr = "";
            if (eventObj.allDay) {
                displayStr = dateStr + " (All Day)";
            } else {
                let timeStr = eventObj.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: hour12Setting });
                if (eventObj.end) {
                    let endTimeStr = eventObj.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: hour12Setting });
                    displayStr = `${dateStr} | ${timeStr} - ${endTimeStr}`;
                } else {
                    displayStr = `${dateStr} at ${timeStr}`;
                }
            }
            document.getElementById('viewEventDate').innerText = displayStr;
            document.getElementById('viewEventColor').style.backgroundColor = eventObj.backgroundColor;

            // Delete Event Logic
            document.getElementById('deleteEventBtn').onclick = function() {
                if (confirm("Delete this event?")) {
                    fetch(`/api/events/${eventObj.id}`, { method: 'DELETE' })
                    .then(r => { if(r.ok) { eventObj.remove(); bootstrap.Modal.getInstance(document.getElementById('viewEventModal')).hide(); }});
                }
            };

            // Edit Event Logic
            document.getElementById('editEventBtn').onclick = function() {
                bootstrap.Modal.getInstance(document.getElementById('viewEventModal')).hide();
                resetForm();
                
                const editModal = new bootstrap.Modal(document.getElementById('eventModal'));
                editModal.show();

                document.getElementById('addEventTitle').innerText = "Edit Event";
                document.getElementById('eventId').value = eventObj.id;
                document.getElementById('eventTitle').value = eventObj.title;
                document.getElementById('eventColor').value = eventObj.backgroundColor;
                
                const isoStart = eventObj.start.toISOString();
                document.getElementById('eventDate').value = isoStart.split('T')[0];

                if (eventObj.allDay) {
                    document.getElementById('allDaySwitch').checked = true;
                    toggleTimeInputs();
                } else {
                    document.getElementById('allDaySwitch').checked = false;
                    toggleTimeInputs();
                    document.getElementById('eventTime').value = toLocalTime(eventObj.start);
                    if (eventObj.end) {
                        document.getElementById('eventEndTime').value = toLocalTime(eventObj.end);
                    }
                }
                checkCategoryLogic(); 
            };
            new bootstrap.Modal(document.getElementById('viewEventModal')).show();
        },

        // --- Date Click Handler (Create New) ---
        dateClick: function(info) {
            resetForm();
            const modal = new bootstrap.Modal(document.getElementById('eventModal'));
            modal.show();
            
            if (info.dateStr.includes('T')) {
                const [datePart, timePart] = info.dateStr.split('T');
                document.getElementById('eventDate').value = datePart;
                document.getElementById('eventTime').value = timePart.substring(0, 5);
                
                // Auto-calculate +1 hour duration
                let [h, m] = timePart.substring(0, 5).split(':').map(Number);
                h = (h + 1) % 24;
                let endH = h.toString().padStart(2, '0');
                document.getElementById('eventEndTime').value = `${endH}:${m}`; 

                document.getElementById('allDaySwitch').checked = false;
            } else {
                document.getElementById('eventDate').value = info.dateStr;
                document.getElementById('allDaySwitch').checked = true;
            }
            toggleTimeInputs();
        }
    });
    
    window.calendar.render();
    checkUpcomingEvents();
    
    // Set UI State
    document.getElementById('timeFormatSelect').value = savedTimeFormat;
    document.getElementById('weekStartSelect').value = savedWeekStart;
    document.getElementById('dateFormatSelect').value = savedDateFormat;

    // Event Listeners
    document.getElementById('allDaySwitch').addEventListener('change', toggleTimeInputs);
    document.getElementById('eventColor').addEventListener('change', checkCategoryLogic);
    document.querySelector('.fab').addEventListener('click', resetForm);
});

// --- HELPER FUNCTIONS ---

function saveEvent() {
    const id = document.getElementById('eventId').value;
    const title = document.getElementById('eventTitle').value;
    const date = document.getElementById('eventDate').value;
    const color = document.getElementById('eventColor').value;
    const isAllDay = document.getElementById('allDaySwitch').checked;
    
    if(title && date) {
        let startValue = date;
        let endValue = null;

        if (!isAllDay) {
            const time = document.getElementById('eventTime').value;
            const endTime = document.getElementById('eventEndTime').value;
            if (!time) { alert("Please select a time."); return; }
            startValue = `${date}T${time}`;

            // Deadlines: Add 1 second duration to ensure it displays correctly without spillover
            if (color === '#dc3545') { 
                endValue = `${date}T${time}:01`; 
            } 
            else if (endTime) {
                // Handle overnight events
                if (endTime < time) {
                    let nextDay = new Date(date);
                    nextDay.setDate(nextDay.getDate() + 1);
                    let nextDayStr = nextDay.toISOString().split('T')[0];
                    endValue = `${nextDayStr}T${endTime}`;
                } else {
                    endValue = `${date}T${endTime}`;
                }
            }
        }

        const payload = { title: title, start: startValue, end: endValue, backgroundColor: color };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/events/${id}` : '/api/events';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {
            window.calendar.refetchEvents();
            bootstrap.Modal.getInstance(document.getElementById('eventModal')).hide();
            resetForm();
        });
    } else {
        alert("Please enter a title and date.");
    }
}

function toggleTimeInputs() {
    const isAllDay = document.getElementById('allDaySwitch').checked;
    document.getElementById('timeInputGroup').style.display = isAllDay ? 'none' : 'flex'; 
    checkCategoryLogic(); 
}

function checkCategoryLogic() {
    const category = document.getElementById('eventColor').value;
    const endContainer = document.getElementById('endTimeContainer');
    const startLabel = document.getElementById('startTimeLabel');
    
    // Customize UI for Deadlines
    if (category === '#dc3545') {
        endContainer.style.visibility = 'hidden'; 
        if (startLabel) startLabel.innerText = "Due Time"; 
    } else {
        endContainer.style.visibility = 'visible';
        if (startLabel) startLabel.innerText = "Start Time"; 
    }
}

function toLocalTime(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    return (new Date(dateObj - offset)).toISOString().slice(11, 16);
}

function resetForm() {
    document.getElementById('addEventTitle').innerText = "Add New Event";
    document.getElementById('addEventForm').reset();
    document.getElementById('eventId').value = "";
    document.getElementById('allDaySwitch').checked = true;
    toggleTimeInputs();
}

function formatDisplayDate(isoDate, format) {
    const [year, month, day] = isoDate.split('-');
    if (format === 'DD-MM-YYYY') return `${day}-${month}-${year}`;
    if (format === 'MM-DD-YYYY') return `${month}-${day}-${year}`;
    return isoDate; 
}

function saveSettings() {
    localStorage.setItem('timeFormat', document.getElementById('timeFormatSelect').value);
    localStorage.setItem('weekStart', document.getElementById('weekStartSelect').value);
    localStorage.setItem('dateFormat', document.getElementById('dateFormatSelect').value);
    localStorage.setItem('theme', document.getElementById('darkModeSwitch').checked ? 'dark' : 'light');
    location.reload();
}

function checkUpcomingEvents() {
    fetch('/api/events').then(r=>r.json()).then(events => {
        const today = new Date().toISOString().split('T')[0];
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate()+1); 
        const tmrwStr = tmrw.toISOString().split('T')[0];
        let alerts = [];
        events.forEach(e => {
            let d = e.start.split('T')[0];
            if(d===today) alerts.push("Today: "+e.title);
            if(d===tmrwStr) alerts.push("Tomorrow: "+e.title);
        });
        if(alerts.length) {
            document.getElementById('notification-area').classList.remove('d-none');
            document.getElementById('notification-text').innerText = alerts.join(" | ");
        }
    });
}