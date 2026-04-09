const map = L.map("map").setView([24.5854, 73.7125], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const studentList = document.getElementById("student-list");
const driverStatus = document.getElementById("driver-status");
const startSharingButton = document.getElementById("start-sharing");
const driverQrCode = document.getElementById("driver-qr-code");
const qrStatus = document.getElementById("qr-status");
const qrSummary = document.getElementById("qr-summary");
const qrAttendanceList = document.getElementById("qr-attendance-list");

const studentLayer = L.layerGroup().addTo(map);
let busMarker = null;
let watchId = null;

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    const rawText = await response.text();
    let data = {};

    if (rawText) {
        try {
            data = JSON.parse(rawText);
        } catch (error) {
            if (rawText.trim().startsWith("<")) {
                throw new Error("Received an HTML page instead of JSON. Refresh the page and log in again.");
            }
            throw new Error(`Received invalid JSON from ${url}.`);
        }
    }

    if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}.`);
    }

    return data;
}

function renderRiderList(items) {
    if (items.length === 0) {
        studentList.textContent = "No student attendance has been marked yet.";
        return;
    }

    studentList.innerHTML = items.map((item) => {
        const stopText = item.lat != null && item.lng != null
            ? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`
            : "Stop not selected";
        const initials = item.username.slice(0, 2).toUpperCase();
        const badgeClass = item.attendance_marked_at ? "badge-green" : "badge-amber";
        const badgeText = item.attendance_marked_at ? "QR Marked" : "Pending";
        return `
            <div class="rider-item">
                <div class="rider-avatar">${initials}</div>
                <div class="rider-info">
                    <div class="rider-name">${item.username}</div>
                    <div class="rider-stop">${stopText}</div>
                </div>
                <span class="badge ${badgeClass}" style="font-size:11px;">${badgeText}</span>
            </div>
        `;
    }).join("");
}

function renderQrAttendance(items) {
    const scannedStudents = items.filter((item) => item.attendance_marked_at);

    if (scannedStudents.length === 0) {
        qrAttendanceList.textContent = "No student has scanned the live QR code yet.";
        qrSummary.textContent = "0 students have scanned the QR code.";
        return;
    }

    qrAttendanceList.innerHTML = scannedStudents.map((item) => {
        const localTime = new Date(item.attendance_marked_at).toLocaleTimeString();
        const initials = item.username.slice(0, 2).toUpperCase();
        return `
            <div class="rider-item">
                <div class="rider-avatar">${initials}</div>
                <div class="rider-info">
                    <div class="rider-name">${item.username}</div>
                    <div class="rider-stop">QR marked at ${localTime}</div>
                </div>
                <span class="badge badge-green" style="font-size:11px;">Scanned</span>
            </div>
        `;
    }).join("");

    qrSummary.textContent = `${scannedStudents.length} student(s) have scanned the QR code today.`;
}

async function loadStudents() {
    try {
        const [todayData, stopData] = await Promise.all([
            fetchJson("/driver/today"),
            fetchJson("/driver/stops")
        ]);

        studentLayer.clearLayers();
        renderRiderList(todayData);
        renderQrAttendance(todayData);

        if (stopData.length > 0) {
            const bounds = [];
            stopData.forEach((stop) => {
                const marker = L.marker([stop.lat, stop.lng]);
                marker.bindPopup(`${stop.name} is waiting here`);
                marker.addTo(studentLayer);
                bounds.push([stop.lat, stop.lng]);
            });

            if (!busMarker && bounds.length > 0) {
                map.fitBounds(bounds, { padding: [30, 30] });
            }
        }
    } catch (error) {
        console.error("Failed to load students", error);
        studentList.textContent = error.message;
        qrAttendanceList.textContent = error.message;
        qrSummary.textContent = "Unable to load QR attendance.";
    }
}

async function sendBusLocation(lat, lng) {
    await fetchJson("/bus/location", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ lat, lng })
    });
}

async function resetBusLocation() {
    await fetchJson("/bus/location/reset", {
        method: "POST"
    });
}

function upsertBusMarker(lat, lng) {
    if (!busMarker) {
        busMarker = L.circleMarker([lat, lng], {
            radius: 10,
            color: "#1368ce",
            fillColor: "#7ab8ff",
            fillOpacity: 0.85
        }).addTo(map);
    } else {
        busMarker.setLatLng([lat, lng]);
    }

    busMarker.bindPopup("Your current bus location");
}

async function startLocationSharing() {
    if (!navigator.geolocation) {
        driverStatus.textContent = "Geolocation is not supported in this browser.";
        return;
    }

    if (watchId !== null) {
        driverStatus.textContent = "Live sharing is already running.";
        return;
    }

    driverStatus.textContent = "Waiting for location permission...";

    try {
        await resetBusLocation();
    } catch (error) {
        driverStatus.textContent = error.message;
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            upsertBusMarker(latitude, longitude);
            map.setView([latitude, longitude], 15);

            try {
                await sendBusLocation(latitude, longitude);
                driverStatus.textContent = "Live bus location is being shared.";
            } catch (error) {
                driverStatus.textContent = error.message;
            }
        },
        () => {
            driverStatus.textContent = "Location permission denied or unavailable.";
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function loadLiveQrCode() {
    try {
        const data = await fetchJson("/driver/qr/live");

        if (!data.scan_url) {
            qrStatus.textContent = "Unable to load live QR code.";
            return;
        }

        driverQrCode.innerHTML = "";
        new QRCode(driverQrCode, {
            text: data.scan_url,
            width: 220,
            height: 220,
            correctLevel: QRCode.CorrectLevel.H
        });

        qrStatus.textContent = `Live QR refreshed. It expires in ${data.expires_in} seconds.`;
    } catch (error) {
        console.error("Failed to load live QR code", error);
        qrStatus.textContent = error.message;
    }
}

startSharingButton.addEventListener("click", startLocationSharing);

loadStudents();
loadLiveQrCode();
setInterval(loadStudents, 10000);
setInterval(loadLiveQrCode, 45000);
