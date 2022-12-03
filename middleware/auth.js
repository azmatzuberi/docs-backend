const jwt = require('jsonwebtoken')

module.exports = function (req, res, next) {
  	const access_token = req.header('api-x-auth-token')
	const authorization_token = req.header('Authorization')

  	if (!access_token && !authorization_token) return res.status(401).send('Access denied. No access or authorization token provided')
  
  	try {
		if (access_token) {
			const decodedAccessToken = jwt.verify(access_token, process.env.JWT_PRIVATE_KEY);
			req.user = decodedAccessToken;
		} else {
			const decodedAuthorizationToken = jwt.verify(authorization_token, process.env.JWT_PRIVATE_KEY);
			req.user = decodedAuthorizationToken;
		}
    next();
	} catch (error) {
		res.status(400).send(error);
	}
};
