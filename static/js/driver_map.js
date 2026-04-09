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
let qrCodeInstance = null;

async function loadStudents() {
    try {
        const [todayResponse, stopResponse] = await Promise.all([
            fetch("/driver/today"),
            fetch("/driver/stops")
        ]);

        const todayData = await todayResponse.json();
        const stopData = await stopResponse.json();

        studentLayer.clearLayers();

        if (!todayResponse.ok || !stopResponse.ok) {
            studentList.textContent = "Unable to load today's students.";
            return;
        }

        if (todayData.length === 0) {
            studentList.textContent = "No student attendance has been marked yet.";
            qrAttendanceList.textContent = "No students available for QR attendance yet.";
            qrSummary.textContent = "0 students have scanned the QR code.";
        } else {
            const items = todayData.map((item) => {
                const stopText = item.lat != null && item.lng != null
                    ? `Stop: ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`
                    : "Stop not selected";
                return `<li><strong>${item.username}</strong> - ${item.status} - ${stopText}</li>`;
            });
            studentList.innerHTML = `<ul class="list">${items.join("")}</ul>`;

            const scannedStudents = todayData.filter((item) => item.attendance_marked_at);
            if (scannedStudents.length === 0) {
                qrAttendanceList.textContent = "No student has scanned the live QR code yet.";
                qrSummary.textContent = "0 students have scanned the QR code.";
            } else {
                const qrItems = scannedStudents.map((item) => {
                    const localTime = new Date(item.attendance_marked_at).toLocaleTimeString();
                    return `<li><strong>${item.username}</strong> - QR marked at ${localTime}</li>`;
                });
                qrAttendanceList.innerHTML = `<ul class="list">${qrItems.join("")}</ul>`;
                qrSummary.textContent = `${scannedStudents.length} student(s) have scanned the QR code today.`;
            }
        }

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
        studentList.textContent = "Unable to load today's students.";
    }
}

async function sendBusLocation(lat, lng) {
    const response = await fetch("/bus/location", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ lat, lng })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "Failed to share bus location.");
    }
}

async function resetBusLocation() {
    const response = await fetch("/bus/location/reset", {
        method: "POST"
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "Failed to clear previous live location.");
    }
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

startSharingButton.addEventListener("click", startLocationSharing);

async function loadLiveQrCode() {
    try {
        const response = await fetch("/driver/qr/live");
        const data = await response.json();

        if (!response.ok || !data.scan_url) {
            qrStatus.textContent = "Unable to load live QR code.";
            return;
        }

        driverQrCode.innerHTML = "";
        qrCodeInstance = new QRCode(driverQrCode, {
            text: data.scan_url,
            width: 220,
            height: 220,
            correctLevel: QRCode.CorrectLevel.H
        });

        qrStatus.textContent = `Live QR refreshed. It expires in ${data.expires_in} seconds.`;
    } catch (error) {
        console.error("Failed to load live QR code", error);
        qrStatus.textContent = "Unable to load live QR code.";
    }
}

loadStudents();
loadLiveQrCode();
setInterval(loadStudents, 10000);
setInterval(loadLiveQrCode, 45000);
