#!/bin/bash
/bin/rm -f /mnt/ramdisk/10percent.bin
/bin/sync
MEMORY=$(/usr/bin/grep MemTotal /proc/meminfo | /usr/bin/awk '{print $2}')
MEMORY_FREE=$(grep MemAvailable /proc/meminfo | /usr/bin/awk '{print $2}')
MEMORY_USED=$(/bin/expr $MEMORY - $MEMORY_FREE)
MEMORY_12=$(/bin/expr $MEMORY \* 12 / 100)
MEMORY_FILL_NEEDED=$(/bin/expr $MEMORY_12 - $MEMORY_USED)
MEMORY_FILL_NEEDED_BYTES=$(/bin/expr $MEMORY_FILL_NEEDED \* 1024)
if [ 0 -lt $MEMORY_FILL_NEEDED ]; then
    /bin/echo "Before…"
    /usr/bin/free -m | /usr/bin/awk 'NR==2{printf "Memory Usage: %s/%sMB (%.2f%%) free: %sMB\n", $3,$2,($3)*100/$2,$4 }'
    echo "It needs $(expr $MEMORY_FILL_NEEDED / 1024) MB"
    # echo "debug MEMORY=$MEMORY MEMORY_FREE=$MEMORY_FREE MEMORY_USED=$MEMORY_USED MEMORY_12=$MEMORY_12 MEMORY_FILL_NEEDED=$MEMORY_FILL_NEEDED MEMORY_FILL_NEEDED_BYTES=$MEMORY_FILL_NEEDED_BYTES"
    /usr/bin/head -c $MEMORY_FILL_NEEDED_BYTES /dev/zero >/mnt/ramdisk/10percent.bin
    #sleep 10
    /bin/echo "After"
    /bin/sync
    MEMORY_AFTER=$(/usr/bin/grep MemTotal /proc/meminfo | /usr/bin/awk '{print $2}')
    MEMORY_FREE_AFTER=$(grep MemAvailable /proc/meminfo | /usr/bin/awk '{print $2}')
    MEMORY_USED_AFTER=$(/bin/expr $MEMORY_AFTER - $MEMORY_FREE_AFTER)
    PCENT_AFTER=$(/bin/expr $MEMORY_USED_AFTER \* 100 / $MEMORY_AFTER)
    # /usr/bin/free -m | /usr/bin/awk 'NR==2{printf "Memory Usage: %s/%sMB (%.2f%%) free: %sMB\n", $3,$2,($3)*100/$2,$4 }'
    # /usr/bin/free -m
    echo "After … $PCENT_AFTER %"
else
    /bin/echo "Already > 12% ($(/bin/expr $MEMORY_FILL_NEEDED / 1024) MB)"
fi
