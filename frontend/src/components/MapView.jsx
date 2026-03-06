import { useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const pinIcon = L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#e05c2a;border:2px solid #0c0c0a;cursor:grab"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

const correctIcon = L.divIcon({
    className: '',
    html: '<div class="marker-pop" style="width:24px;height:24px;border-radius:50%;background:#3a8c5c;border:2px solid #0c0c0a"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

export default function MapView({
    onPinPlace,
    pin,
    correctPin = null,
    opponentPins = [],
    interactive = true,
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const playerMarkerRef = useRef(null);
    const correctMarkerRef = useRef(null);
    const lineRef = useRef(null);
    const opponentMarkersRef = useRef([]);
    const onPinPlaceRef = useRef(onPinPlace);
    const interactiveRef = useRef(interactive);

    useEffect(() => { onPinPlaceRef.current = onPinPlace; }, [onPinPlace]);
    useEffect(() => { interactiveRef.current = interactive; }, [interactive]);

    // Init map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [20, 10],
            zoom: 2,
            zoomControl: false,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        map.getPane('tilePane').style.filter = 'grayscale(1) brightness(0.35) contrast(1.1)';

        map.on('click', (e) => {
            if (!interactiveRef.current) return;
            onPinPlaceRef.current?.(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    }, []);

    // Player pin (draggable)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (playerMarkerRef.current) {
            map.removeLayer(playerMarkerRef.current);
            playerMarkerRef.current = null;
        }

        if (pin) {
            const marker = L.marker([pin.lat, pin.lng], {
                icon: pinIcon,
                draggable: interactiveRef.current,
            }).addTo(map);

            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                onPinPlaceRef.current?.(pos.lat, pos.lng);
            });

            playerMarkerRef.current = marker;
        }
    }, [pin]);

    // Correct pin + line
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (correctMarkerRef.current) {
            map.removeLayer(correctMarkerRef.current);
            correctMarkerRef.current = null;
        }
        if (lineRef.current) {
            map.removeLayer(lineRef.current);
            lineRef.current = null;
        }

        if (correctPin) {
            correctMarkerRef.current = L.marker([correctPin.lat, correctPin.lng], {
                icon: correctIcon,
                interactive: false,
            }).addTo(map);

            if (pin) {
                lineRef.current = L.polyline(
                    [[pin.lat, pin.lng], [correctPin.lat, correctPin.lng]],
                    { color: '#e05c2a', weight: 1.5, dashArray: '4 6', opacity: 0.5 }
                ).addTo(map);

                map.fitBounds(
                    [[pin.lat, pin.lng], [correctPin.lat, correctPin.lng]],
                    { padding: [80, 80], animate: true }
                );
            }
        }
    }, [correctPin]);

    // Opponent pins
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        opponentMarkersRef.current.forEach((m) => map.removeLayer(m));
        opponentMarkersRef.current = [];

        opponentPins.forEach((op) => {
            const marker = L.circleMarker([op.lat, op.lng], {
                radius: 6,
                fillColor: '#6b6b60',
                fillOpacity: 1,
                color: '#0c0c0a',
                weight: 1,
            })
                .bindTooltip(op.name, { direction: 'top', offset: [0, -8] })
                .addTo(map);
            opponentMarkersRef.current.push(marker);
        });
    }, [opponentPins]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
