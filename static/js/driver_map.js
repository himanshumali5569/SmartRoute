const map = L.map("map").setView([24.5854, 73.7125], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const studentList = document.getElementById("student-list");
const driverStatus = document.getElementById("driver-status");
const startSharingButton = document.getElementById("start-sharing");

const studentLayer = L.layerGroup().addTo(map);
let busMarker = null;
let watchId = null;

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
        } else {
            const items = todayData.map((item) => {
                const stopText = item.lat != null && item.lng != null
                    ? `Stop: ${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`
                    : "Stop not selected";
                return `<li><strong>${item.username}</strong> - ${item.status} - ${stopText}</li>`;
            });
            studentList.innerHTML = `<ul class="list">${items.join("")}</ul>`;
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

loadStudents();
setInterval(loadStudents, 10000);
