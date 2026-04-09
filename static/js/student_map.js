const defaultCenter = [24.5854, 73.7125];
const map = L.map("map").setView(defaultCenter, 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const attendanceStatus = document.getElementById("attendance-status");
const selectionStatus = document.getElementById("selection-status");
const locationStatus = document.getElementById("location-status");
const busStatus = document.getElementById("bus-status");
const yesButton = document.getElementById("mark-yes");
const noButton = document.getElementById("mark-no");
const useCurrentLocationButton = document.getElementById("use-current-location");
const saveStopButton = document.getElementById("save-stop");
const scanStatus = document.getElementById("scan-status");
const startQrScanButton = document.getElementById("start-qr-scan");
const stopQrScanButton = document.getElementById("stop-qr-scan");
const qrAttendanceState = document.getElementById("qr-attendance-state");
const qrAttendanceTime = document.getElementById("qr-attendance-time");

let selectedLat = null;
let selectedLng = null;
let selectedMarker = null;
let busMarker = null;
let accuracyCircle = null;
let qrScanner = null;
let qrScannerRunning = false;

const MAX_ACCEPTABLE_ACCURACY_METERS = 120;
const TARGET_ACCURACY_METERS = 50;

function setSelectedMarker(lat, lng, popupText) {
    selectedLat = lat;
    selectedLng = lng;

    if (!selectedMarker) {
        selectedMarker = L.marker([lat, lng], {
            draggable: true
        }).addTo(map);
        selectedMarker.on("dragend", () => {
            const markerPosition = selectedMarker.getLatLng();
            selectedLat = markerPosition.lat;
            selectedLng = markerPosition.lng;
            selectionStatus.textContent = `Adjusted stop: ${selectedLat.toFixed(5)}, ${selectedLng.toFixed(5)}`;
            locationStatus.textContent = "Marker adjusted manually. Save this exact stop if it matches your pickup point.";
        });
    } else {
        selectedMarker.setLatLng([lat, lng]);
    }

    selectedMarker.bindPopup(popupText).openPopup();
    map.setView([lat, lng], 15);
    selectionStatus.textContent = `Selected stop: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function updateAccuracyCircle(lat, lng, accuracy) {
    if (!accuracyCircle) {
        accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: "#1368ce",
            fillColor: "#b9d6ff",
            fillOpacity: 0.18
        }).addTo(map);
    } else {
        accuracyCircle.setLatLng([lat, lng]);
        accuracyCircle.setRadius(accuracy);
    }
}

function setAttendanceText(useBus) {
    if (useBus === "YES") {
        attendanceStatus.textContent = "You are marked as coming today.";
        return;
    }

    if (useBus === "NO") {
        attendanceStatus.textContent = "You are marked as not coming today.";
        return;
    }

    attendanceStatus.textContent = "Attendance not marked yet.";
}

function setScanText(data) {
    if (data?.attendance_marked_at) {
        const localTime = new Date(data.attendance_marked_at).toLocaleTimeString();
        scanStatus.textContent = `Attendance marked by QR at ${localTime}.`;
        qrAttendanceState.textContent = "Marked by live QR";
        qrAttendanceTime.textContent = localTime;
        return;
    }

    scanStatus.textContent = "Scan the driver's live QR code to mark today's bus attendance.";
    qrAttendanceState.textContent = "Not marked yet";
    qrAttendanceTime.textContent = "Not available";
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

async function markAttendance(choice) {
    try {
        const data = await postJson("/available", { use_bus: choice });
        setAttendanceText(choice);
        if (choice === "NO" && selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
            selectedLat = null;
            selectedLng = null;
            selectionStatus.textContent = "Your stop was cleared for today.";
        }
        alert(data.message);
    } catch (error) {
        alert(error.message);
    }
}

async function saveStop() {
    if (selectedLat === null || selectedLng === null) {
        alert("Please choose a stop on the map first.");
        return;
    }

    try {
        const data = await postJson("/save_stop", {
            lat: selectedLat,
            lng: selectedLng
        });
        setAttendanceText("YES");
        alert(data.message);
    } catch (error) {
        alert(error.message);
    }
}

async function loadStudentState() {
    try {
        const response = await fetch("/student/today");
        const data = await response.json();

        setAttendanceText(data.use_bus);
        setScanText(data);
        if (typeof data.lat === "number" && typeof data.lng === "number") {
            setSelectedMarker(data.lat, data.lng, "Your saved stop");
        }
    } catch (error) {
        console.error("Failed to load student state", error);
    }
}

async function loadBusLocation() {
    try {
        const response = await fetch("/bus/latest");
        const data = await response.json();

        if (typeof data.lat !== "number" || typeof data.lng !== "number") {
            busStatus.textContent = "Bus location will appear here when the driver shares it.";
            return;
        }

        if (!busMarker) {
            busMarker = L.circleMarker([data.lat, data.lng], {
                radius: 10,
                color: "#b42318",
                fillColor: "#f97066",
                fillOpacity: 0.85
            }).addTo(map);
        } else {
            busMarker.setLatLng([data.lat, data.lng]);
        }

        const label = data.driver ? `Driver ${data.driver}` : "Driver";
        busMarker.bindPopup(`${label} current bus location`);
        busStatus.textContent = `${label} is sharing the bus location now.`;
    } catch (error) {
        console.error("Failed to load bus location", error);
    }
}

map.on("click", (event) => {
    setSelectedMarker(event.latlng.lat, event.latlng.lng, "Selected pickup spot");
    locationStatus.textContent = "Manual stop selected from map. You can drag the marker if needed.";
});

yesButton.addEventListener("click", () => {
    markAttendance("YES");
});

noButton.addEventListener("click", () => {
    markAttendance("NO");
});

saveStopButton.addEventListener("click", () => {
    saveStop();
});

async function markAttendanceFromQr(rawText) {
    let token = "";

    try {
        const scanUrl = new URL(rawText);
        token = scanUrl.searchParams.get("token") || "";
    } catch (error) {
        token = rawText;
    }

    if (!token) {
        alert("The scanned QR code does not contain a valid attendance token.");
        return;
    }

    const data = await postJson("/student/attendance/scan", { token });
    setAttendanceText("YES");
    setScanText(data);
    alert(data.message);
}

async function stopQrScanner() {
    if (!qrScanner || !qrScannerRunning) {
        return;
    }

    await qrScanner.stop();
    qrScannerRunning = false;
    scanStatus.textContent = "QR scan stopped. You can start it again anytime.";
}

async function startQrScanner() {
    if (typeof Html5Qrcode === "undefined") {
        alert("QR scanner library failed to load.");
        return;
    }

    if (qrScannerRunning) {
        scanStatus.textContent = "QR scanner is already running.";
        return;
    }

    if (!qrScanner) {
        qrScanner = new Html5Qrcode("qr-reader");
    }

    scanStatus.textContent = "Camera is opening. Point it at the driver's live QR code.";

    try {
        await qrScanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: 220
            },
            async (decodedText) => {
                try {
                    await stopQrScanner();
                    await markAttendanceFromQr(decodedText);
                } catch (error) {
                    scanStatus.textContent = error.message;
                    alert(error.message);
                }
            }
        );
        qrScannerRunning = true;
    } catch (error) {
        scanStatus.textContent = "Unable to start QR scanner. Please allow camera access.";
        alert("Unable to start QR scanner. Please allow camera access.");
    }
}

startQrScanButton.addEventListener("click", () => {
    startQrScanner();
});

stopQrScanButton.addEventListener("click", () => {
    stopQrScanner();
});

useCurrentLocationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported in this browser.");
        return;
    }

    locationStatus.textContent = "Detecting your location. Please keep GPS/location on for a few seconds.";

    let settled = false;
    let bestPosition = null;

    const finishWithPosition = (position, reasonText) => {
        if (settled) {
            return;
        }

        settled = true;
        navigator.geolocation.clearWatch(watchId);

        const { latitude, longitude, accuracy } = position.coords;
        setSelectedMarker(latitude, longitude, "Approximate current location");
        updateAccuracyCircle(latitude, longitude, accuracy);
        locationStatus.textContent = `${reasonText} Accuracy: about ${Math.round(accuracy)} meters. Drag the marker to the exact stop before saving if needed.`;
    };

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            updateAccuracyCircle(latitude, longitude, accuracy);
            map.setView([latitude, longitude], 16);

            if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
                bestPosition = position;
                locationStatus.textContent = `Trying to improve location accuracy. Current estimate: about ${Math.round(accuracy)} meters.`;
            }

            if (accuracy <= TARGET_ACCURACY_METERS) {
                finishWithPosition(position, "Accurate current location captured.");
            }
        },
        () => {
            if (!settled) {
                locationStatus.textContent = "Unable to fetch current location. You can still click on the map manually.";
                alert("Unable to fetch your current location.");
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }
    );

    setTimeout(() => {
        if (settled) {
            return;
        }

        navigator.geolocation.clearWatch(watchId);

        if (bestPosition) {
            const accuracy = bestPosition.coords.accuracy;
            if (accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS) {
                finishWithPosition(bestPosition, "Best available current location captured.");
            } else {
                const { latitude, longitude } = bestPosition.coords;
                setSelectedMarker(latitude, longitude, "Approximate current location");
                updateAccuracyCircle(latitude, longitude, accuracy);
                locationStatus.textContent = `Location seems too rough: about ${Math.round(accuracy)} meters. Drag the marker or click manually on the map for the exact stop.`;
            }
        } else {
            locationStatus.textContent = "Location could not be confirmed. Please click manually on the map.";
        }
    }, 12000);
});

loadStudentState();
loadBusLocation();
setInterval(loadBusLocation, 10000);
