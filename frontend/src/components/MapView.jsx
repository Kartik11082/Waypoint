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

function useInitMap(containerRef, interactiveRef, onPinPlaceRef) {
    const mapRef = useRef(null);
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
            center: [20, 10],
            zoom: 2,
            minZoom: 2,
            maxZoom: 10,
            zoomControl: false,
            attributionControl: false,
            maxBounds: [[-90, -180], [90, 180]],
            maxBoundsViscosity: 1.0,
            worldCopyJump: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            noWrap: true,
            bounds: [[-90, -180], [90, 180]],
        }).addTo(map);
        map.getPane('tilePane').style.filter = 'grayscale(1) brightness(0.35) contrast(1.1)';
        map.fitWorld({ animate: false });
        map.getContainer().style.background = '#1a1a18';

        map.on('click', (e) => {
            if (!interactiveRef.current) return;
            onPinPlaceRef.current?.(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; };
    }, []);
    return mapRef;
}

function usePlayerMarker(mapRef, pin, interactiveRef, onPinPlaceRef) {
    const playerMarkerRef = useRef(null);
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
}

function useCorrectMarker(mapRef, correctPin, correctBounds, pin) {
    const correctMarkerRef = useRef(null);
    const correctRectRef = useRef(null);
    const lineRef = useRef(null);
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (correctMarkerRef.current) {
            map.removeLayer(correctMarkerRef.current);
            correctMarkerRef.current = null;
        }
        if (correctRectRef.current) {
            map.removeLayer(correctRectRef.current);
            correctRectRef.current = null;
        }
        if (lineRef.current) {
            map.removeLayer(lineRef.current);
            lineRef.current = null;
        }

        if (correctPin) {
            if (correctBounds) {
                const bounds = [
                    [correctBounds.sw_lat, correctBounds.sw_lng],
                    [correctBounds.ne_lat, correctBounds.ne_lng],
                ];

                correctRectRef.current = L.rectangle(bounds, {
                    color: '#3a8c5c',
                    weight: 2,
                    fillColor: '#3a8c5c',
                    fillOpacity: 0.12,
                    dashArray: '6 4',
                }).addTo(map);
            }

            correctMarkerRef.current = L.marker([correctPin.lat, correctPin.lng], {
                icon: correctIcon,
                interactive: false,
            }).addTo(map);

            if (pin) {
                lineRef.current = L.polyline(
                    [[pin.lat, pin.lng], [correctPin.lat, correctPin.lng]],
                    { color: '#e05c2a', weight: 1.5, dashArray: '4 6', opacity: 0.5 }
                ).addTo(map);

                if (correctBounds) {
                    const allBounds = L.latLngBounds([
                        [correctBounds.sw_lat, correctBounds.sw_lng],
                        [correctBounds.ne_lat, correctBounds.ne_lng],
                        [pin.lat, pin.lng],
                    ]);
                    map.fitBounds(allBounds, {
                        padding: [60, 60],
                        animate: true,
                        maxZoom: 8,
                    });
                    if (map.getZoom() < 2) {
                        map.setZoom(2);
                    }
                } else {
                    map.fitBounds(
                        [[pin.lat, pin.lng], [correctPin.lat, correctPin.lng]],
                        { padding: [80, 80], animate: true }
                    );
                }
            }
        }
    }, [correctPin, correctBounds]);
}

function useOpponentMarkers(mapRef, opponentPins) {
    const opponentMarkersRef = useRef([]);
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
}

function useWireMarkerLayer(mapRef, wirePins) {
    const wirePinsRef = useRef([]);
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        wirePinsRef.current.forEach((m) => map.removeLayer(m));
        wirePinsRef.current = [];

        if (!wirePins || wirePins.length === 0) return;

        wirePins.forEach((wp) => {
            const m = L.circleMarker([wp.lat, wp.lng], {
                radius: 4,
                fillColor: '#6b6b60',
                fillOpacity: 0.35,
                color: 'transparent',
                weight: 0,
            }).addTo(map);
            wirePinsRef.current.push(m);
        });
    }, [wirePins]);
}

export default function MapView({
    onPinPlace,
    pin,
    correctPin = null,
    correctBounds = null,
    wirePins = [],
    opponentPins = [],
    interactive = true,
}) {
    const containerRef = useRef(null);
    const onPinPlaceRef = useRef(onPinPlace);
    const interactiveRef = useRef(interactive);

    useEffect(() => { onPinPlaceRef.current = onPinPlace; }, [onPinPlace]);
    useEffect(() => { interactiveRef.current = interactive; }, [interactive]);

    const mapRef = useInitMap(containerRef, interactiveRef, onPinPlaceRef);
    usePlayerMarker(mapRef, pin, interactiveRef, onPinPlaceRef);
    useCorrectMarker(mapRef, correctPin, correctBounds, pin);
    useOpponentMarkers(mapRef, opponentPins);
    useWireMarkerLayer(mapRef, wirePins);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                background: '#1a1a18',
            }}
        />
    );
}
