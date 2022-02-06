const getRandom = () => {
    return parseInt(Math.random() * 10000000000)+'';
}
const userId = getRandom();
const activeClients = new Map();
const localStream = new MediaStream();
const configuration = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ]
};

(async () => {
    const constraints = {'video': true, 'audio': true};
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream.getTracks().forEach((track) => {
        stream.addTrack(track);
        localStream.addTrack(track);
    });
    document.getElementById('localVideo').srcObject = stream;
})()


async function createOffer(clientId = 'demo') {
    const peerConnection = new RTCPeerConnection(configuration);
    const candidates = new Map();
    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.onicecandidate = function(event) {
        if(event.candidate){
            firebase.database().ref(`room${roomId}/room/u${clientId}/c${userId}/offerCandidates`).push({candidate: JSON.stringify(event.candidate)});
        }
    }
    peerConnection.ontrack = () => {
        console.log(track);
    }
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });
    localStream.onremovetrack = function(event) {
        
    }
    firebase.database().ref(`room${roomId}/room/u${userId}/c${clientId}/answer`).on('value', async function(snapshot){
        const values = snapshot.val();
        if( values ) {
            const answer = JSON.parse(values.answer);
            const remoteDesc = new RTCSessionDescription(answer);
            await peerConnection.setRemoteDescription(remoteDesc);
        }
    });
    firebase.database().ref(`room${roomId}/room/u${userId}/c${clientId}/answerCandidates`).on('value', async function(snapshot){
        const values = snapshot.val();
        if(values){
            for( const id in values ){
                if(!candidates.has(id)){
                    candidates.set(id, true);
                    const candidate = JSON.parse(values[id].candidate);
                    peerConnection.addIceCandidate(candidate);
                }
            }
        }
    });
    const offer = await peerConnection.createOffer({offerToReceiveAudio: 1});
    await peerConnection.setLocalDescription(offer);
    firebase.database().ref(`room${roomId}/room/u${clientId}/c${userId}/offer`).set({offer: JSON.stringify(offer), userId, clientId});
}

async function createAnswer(clientId = 'demo') {
    const peerConnection = new RTCPeerConnection(configuration);
    const candidates = new Map();

    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.onicecandidate = function(event) {
        if(event.candidate){
            firebase.database().ref(`room${roomId}/room/u${clientId}/c${userId}/answerCandidates`).push({candidate: JSON.stringify(event.candidate)});
        }
    }
    peerConnection.ontrack = (event) => {
        const stream = new MediaStream();
        stream.addTrack(event.track);
        if(event.track.kind === 'video'){
            const videoDOM = document.createElement('video');
            videoDOM.setAttribute('autoplay', true);
            videoDOM.setAttribute('playsinline', true);
            videoDOM.setAttribute('muted', true);
            document.getElementById('videos').appendChild(videoDOM);
            videoDOM.srcObject = stream;

        }else{
            const audioDOM = document.createElement('audio');
            audioDOM.setAttribute('autoplay', true);
            audioDOM.setAttribute('playsinline', true);
            document.getElementById('audios').appendChild(audioDOM);
            audioDOM.srcObject = stream;
        }
    }
    firebase.database().ref(`room${roomId}/room/u${userId}/c${clientId}/offer`).on('value', async function(snapshot){
        const values = snapshot.val();
        if( values ) {
            const offer = JSON.parse(values.offer);
            peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            firebase.database().ref(`room${roomId}/room/u${clientId}/c${userId}/answer`).set({answer: JSON.stringify(answer), userId, clientId});
        }
    });
    firebase.database().ref(`room${roomId}/room/u${userId}/c${clientId}/offerCandidates`).on('value', async function(snapshot){
        const values = snapshot.val();
        if(values){
            for( const id in values ){
                if(!candidates.has(id)){
                    candidates.set(id, true);
                    const candidate = JSON.parse(values[id].candidate);
                    peerConnection.addIceCandidate(candidate);
                }
            }
        }
    });


}

async function joinRoom() {
    firebase.database().ref(`room${roomId}/users/${userId}`).set({online: true});
    firebase.database().ref(`room${roomId}/users/${userId}`).onDisconnect().set({online: false});
    firebase.database().ref(`room${roomId}/users`).on('value', function(snapshot){
        const values = snapshot.val();
        for(const id in values){
            if(values[id].online && id != userId && !activeClients.has(id)){
                activeClients.set(id, {
                    offerCreated: true
                });
                createOffer(id);
            }
        }
    });
    firebase.database().ref(`room${roomId}/room/u${userId}`).on('value', function(snapshot){
        let i = 0;
        const values = snapshot.val();
        for(const temp in values){
            const clientId = temp.substring(1, temp.length);
            if(activeClients.has(clientId) && !activeClients.get(clientId).answerCreated){
                activeClients.get(clientId).answerCreated = true;
                createAnswer(clientId);
                console.log(++i);
            }
        }
    })
}

async function createRoom() {
    const roomId = getRandom();
    firebase.database().ref(`room${roomId}/users`).set('');
    window.location.replace(window.location.href + '?roomId='+roomId);
}
