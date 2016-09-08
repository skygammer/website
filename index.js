var express = require( 'express' ),
	app = express(),
	server = require( 'http' ).Server( app ),
	path = require( 'path' ),
	readline = require( 'readline' ),
	socketIO = require( 'socket.io' )( server ),
	fs = require( 'fs' ),
	renderUnit = require( 'js2html' ).renderUnit;

var myApps = [ 'chat room', ],
	myAppChatRoomEvents = [ 'account', 'chat message', ];

app.use( express.static( path.join( __dirname, 'public' ) ) );

app.get( '/', function( request, response ) {
	response.sendFile( path.join( __dirname, 'index.html' ) );
} );
server.listen( process.env.PORT ? process.env.PORT : 0, () => {
	console.log( 'Server listening on ' + server.address().port );
	console.log( 'May press Ctrl-C to close the server\n' );
	readline.createInterface( {
		input: process.stdin,
		output: process.stdout
	} ).on( 'SIGINT', () => {
		process.emit( 'SIGINT' );
	} );
} );

process.on( 'SIGINT', () => {
	socketIO.close();
	console.log( 'Server closed.' );
	process.exit();
} );

socketIO.on( 'connection', ( socket ) => {
	console.log( new Date() + '\n' + 'Connection: ' + socket.id + ' from ' + socket.handshake.address );

	socket.on( 'account', ( data ) => {
		handle( socket, 'account', data );
	} );
	socket.on( 'chat message', function( data ) {
		handle( socket, 'chat message', data );
	} );
	socket.on( 'disconnect', function() {
		console.log( new Date() + '\n' + 'Disconnect: ' + socket.id + ' from ' + socket.handshake.address );
		// socketIO.emit( 'system', {
		// 	system: {
		// 		message: socket.myApp.chatRoom.account.username + ' left.',
		// 	}
		// } );
	} );
} );

function availPropNames( object, propNames ) {
	if ( object ) {
		var propNamesArray = propNames.split( '.' ),
			currentPropNames = 'object';
		for ( propNameIndex in propNamesArray ) {
			currentPropNames += '.' + propNamesArray[ propNameIndex ];
			if ( !eval( currentPropNames ) ) {
				eval( currentPropNames + '=' + ( propNamesArray.length - 1 != propNameIndex ? '{}' : 'null' ) );
			}
		}
	}
}

// Capitalize first letter of each word 
function capWords( string ) {
	return string.replace( /\w\S*/g, ( word ) => {
		return word.charAt( 0 ).toUpperCase() + word.substr( 1 );
	} );
}

// Lower fist letter of each word
function lowWords( string ) {
	return string.replace( /\w\S*/g, ( word ) => {
		return word.charAt( 0 ).toLowerCase() + word.substr( 1 );
	} );
}

// words in string into a word
function oneWord( string ) {
	return string.replace( / /g, '' );
}

// Name variables associated with my app events
function nameEventVars( myApp, event ) {
	var eVarNames = null,
		myAppPrefix = null,
		key = null;
	if ( -1 != myApps.indexOf( myApp ) ) {
		myAppPrefix = oneWord( capWords( myApp ) );
		if ( -1 != eval( 'myApp' + myAppPrefix + 'Events' ).indexOf( event ) ) {
			key = lowWords( oneWord( capWords( event ) ) );
			eVarNames = {};
			eVarNames.myAppPrefix = myAppPrefix;
			eVarNames.event = event;
			eVarNames.key = key;
			eVarNames.prefix = oneWord( 'myApp' + myAppPrefix + capWords( key ) );
		};
	}
	return eVarNames;
}

function authorize( socket, eVarNames, data ) {
	if ( eVarNames && -1 != eval( 'myApp' + eVarNames.myAppPrefix + 'Events' ).indexOf( 'account' ) ) {
		availPropNames( socket, 'myApp.' + lowWords( eVarNames.myAppPrefix ) + '.account' );
		if ( !eval( 'socket.myApp.' + lowWords( eVarNames.myAppPrefix ) + '.account' ) && !data.account ) {
			data.nextEvent = eVarNames.event;
			data.nextEventData = data[ eVarNames.key ];
			data[ eVarNames.key ] = undefined;
			console.log( 'Authorize: ' + JSON.stringify( data ) );
			handle( socket, 'account', data );
			return false;
		}
	}
	return true;
}

// Handle my app events
function handle( socket, event, data ) {
	console.log( new Date() + '\n' + capWords( event ) + ': ' + socket.id + ' from ' + socket.handshake.address );
	var eVarNames = nameEventVars( data.myApp, event );

	if ( eVarNames ) {

		if ( 'account' != event && !eval( 'data.' + eVarNames.key ) ) {
			return false;
		}
		else {
			return eval( eVarNames.prefix + 'Handler(socket,eVarNames,data)' );
		}
	}

	return false;

}

function myAppChatRoomAccountHandler( socket, eVarNames, data ) {

	if ( eVarNames ) {
		data.myApp = 'chat room';
		var unit = [
			'div',
			{
				'data-role': 'page',
				'data-dialog': 'true',
				'isAccountPage': 'true'
			},
			[
				[
					'div',
					{
						'data-role': 'header'
					},
					[]
				],
				[
					'div.ui-content',
					{
						'data-role': 'main'
					},
					[]
				],
				[
					'script',
					{},
					[]
				]
			]
		];
		var stringNode;

		availPropNames( socket, 'myApp.chatRoom.account' );
		if ( data.account || socket.myApp.chatRoom.account ) {
			data.isDefaultPage = false;
			data.pageId = '#accountPage';
			if ( data.account ) {
				socket.myApp.chatRoom.account = data.account;
				socketIO.emit( 'system', {
					system: {
						message: socket.myApp.chatRoom.account.username + ' joined.'
					},
				} );
			}
			data.account = {
				username: socket.myApp.chatRoom.account.username,
			};
			unit[ 2 ][ 0 ][ 2 ].push(
				[ 'h1',
					{},
					[
						socket.myApp.chatRoom.account.username
					]
				]
			);
		}
		else {
			data.isDefaultPage = true;
			data.pageId = '#loginPage';
			unit[ 2 ][ 0 ][ 2 ].push(
				[ 'h1',
					{},
					[
						'Your name, please?'
					]
				]
			);
			unit[ 2 ][ 1 ][ 2 ].push(
				[
					'input/',
					{
						'type': 'text',
						'name': 'username',
						'placeholder': 'You are ...',
						'autocomplete': 'off',
						'data-clear-btn': 'true'
					}
				]
			);
			unit[ 2 ][ 1 ][ 2 ].push(
				[
					'button',
					{
						'name': 'login',
						'class': 'ui-btn ui-icon-user ui-btn-icon-left'
					},
					[
						'Login'
					]
				]
			);
			unit[ 2 ][ 1 ][ 2 ].push(
				[
					'button',
					{
						'name': 'register',
						'class': 'ui-btn ui-icon-star ui-btn-icon-left'
					},
					[
						'New'
					]
				]
			);

			stringNode = '$("' + data.pageId + ' [data-role=main] button").click( (event) => {';
			stringNode += '	if ($("' + data.pageId + ' [name=username]").val().trim()) {';
			stringNode += '		socket.emit("account", {';
			stringNode += '			myApp: "chat room",';
			stringNode += '			account: {';
			stringNode += '				username: $("' + data.pageId + ' [name=username]").val().trim(),';
			stringNode += '			},';
			stringNode += '		});';
			stringNode += '	}';
			stringNode += '});';
			unit[ 2 ][ 2 ][ 2 ].push( stringNode );
		}
		unit[ 0 ] = 'div' + data.pageId;
		data.page = renderUnit( unit );
		socket.emit( 'account', data );
		return true;
	}
	return false;
}

function myAppChatRoomChatMessageHandler( socket, eVarNames, data ) {
	if ( eVarNames && data.chatMessage ) {
		socketIO.emit( 'chat message', {
			myApp: 'chat room',
			account: {
				username: socket.myApp.chatRoom.account.username,
			},
			chatMessage: {
				message: data.chatMessage.message,
			},
		} );
		return true;
	}
	return false;
}
