#!/bin/bash

# /usr/local/bin/compile-n-deploy.sh vBETA
# author: rod@teiga.mx
# Deploys WebWorks Apps to PlayBook Simulator
# usage: compile-n-deploy.sh app_directory target_ip

USAGE_MSG="usage: $0 app_directory target_ip"

# Checks the number of command-line arguments
if [ $# -ne 2 ]
then
	echo $USAGE_MSG
	exit 85 # Wrong arguments
fi

# Checks if app directory exists
if [ -d $1 ]
then
	APP=$1
else
	echo "$1 app directory doesn't exist."
	exit $?
fi

TARGET=$2
COMPILE="/Users/Rod/bbwp/bbwp"
DEPLOY="/Users/Rod/bbwp/blackberry-tablet-sdk/bin/blackberry-deploy"
PASSWORD="YOURPASSWORD"

# Delete previous binaries

if [ -f $APP.zip ]
then
	rm $APP.zip
fi

if [ -d $APP/bin ]
then 
	rm -rf $APP/bin
fi

# Remove hidden files

# NOT WORKING: rm -r $APP/.*

# Hack to compress every file in the directory
cd $APP
zip -r ../$APP * || exit $?
cd ..
# zip -r $APP.zip $APP

# Compile .bar file
$COMPILE $APP.zip -o $APP/bin || exit $?

# Install app in simulator
$DEPLOY -installApp -device $TARGET -package $APP/bin/$APP.bar -password $PASSWORD && echo "Everything went fine."

exit 0
