#!/bin/bash

# /usr/local/bin/sign-n-deploy.sh vBETA
# author: rod@teiga.mx
# Deploys SIGNED WebWorks Apps to PlayBook Simulator
# usage: sign-n-deploy.sh app_directory target_ip build_version

USAGE_MSG="usage: $0 app_directory target_ip build_version"

# Checks the number of command-line arguments
if [ $# -ne 3 ]
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
BUILDNO=$3
COMPILE="bbwp"
DEPLOY="blackberry-deploy"
PASSWORD="YOUR_SIM_PASSWORD"
DEPLOY_PASS="YOUR_APPWORLD_PASSWORD"

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

# Compile and sign .bar file
$COMPILE $APP.zip -gcsk $PASSWORD -gp12 $PASSWORD -buildId $BUILDNO -o $APP/bin || exit $?

# Install app in simulator
$DEPLOY -installApp -device $TARGET -package $APP/bin/$APP.bar -password $DEPLOY_PASS && echo "Everything went fine."

exit 0
