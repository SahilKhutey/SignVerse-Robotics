class SignVerseSDK:

    def connect(self):

        return "SDK Connected"

    def send_command(self, command):

        return {
            "command": command,
            "status": "sent"
        }
