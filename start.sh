#! /bin/sh
# start.sh

if [ -z $NODE_PATH ]; then
	export NODE_PATH=/usr/lib/nodejs:/usr/lib/node_modules:/usr/share/javascript
	echo "NODE_PATH updated to ${NODE_PATH}"
else
	echo "NODE_PATH is ${NODE_PATH}"
fi

delayScript()
{
	sleep 30

	cd /opt/geroix/gero
	node index.js
}

delayScript &
