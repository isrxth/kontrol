CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Courses / Modules Table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    credits INT DEFAULT 3,
    total_lectures INT NOT NULL,
    required_ratio FLOAT DEFAULT 0.80,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Timetable Schedule Table (one row per occupied cell of the Mon-Fri grid)
CREATE TABLE IF NOT EXISTS timetable_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1 = Monday, 5 = Friday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(50),
    is_cancelled BOOLEAN DEFAULT FALSE
);

-- Weekly swap overrides: for the week starting week_start (a Monday),
-- the modules+venues of slot_a and slot_b are exchanged.
CREATE TABLE IF NOT EXISTS timetable_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL,
    slot_a UUID NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
    slot_b UUID NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (week_start, slot_a, slot_b)
);

-- Attendance Logs Table (slot_time NULL = logged without slot context)
CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    slot_time TIME,
    status VARCHAR(10) CHECK (status IN ('ATTENDED', 'SKIPPED', 'CANCELLED')),
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE NULLS NOT DISTINCT (course_id, log_date, slot_time)
);
