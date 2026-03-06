import { useState, useRef, useEffect } from 'react';

export function useTimer(initialSeconds, onExpire) {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const intervalRef = useRef(null);
    const onExpireRef = useRef(onExpire);

    useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
    useEffect(() => { return () => clearInterval(intervalRef.current); }, []);

    const start = () => {
        setTimeLeft(initialSeconds);
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(intervalRef.current);
                    onExpireRef.current?.();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stop = () => {
        clearInterval(intervalRef.current);
    };

    const reset = () => {
        stop();
        setTimeLeft(initialSeconds);
    };

    return { timeLeft, start, stop, reset };
}
