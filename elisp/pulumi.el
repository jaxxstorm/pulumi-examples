;;; pulumi.el -- Summary -*- lexical-binding: t; -*-

;;; Commentary:
;;;
;;; pulumi.el provides a (trivial) library and a working example to deploy cloud
;;; resources with Pulumi in Emacs Lisp.

;;; Code:

(defmacro pulumi (name body)
  "Setup a pulumi stack named `pulumi-name' (based on NAME) that deploys BODY."
  (declare (indent defun))
  `(defun ,(intern (format "pulumi-%s" name)) ()
       (princ (json-serialize (quote ,body)))))

;;; Example:

(pulumi emacs
  (:resources
   (:my-bucket (:type "aws:s3:Bucket"
                :properties (:website (:indexDocument "index.html")))
    :index.html (:type "aws:s3:BucketObject"
                 :properties (
                              :bucket "${my-bucket}"
                              :source (:Fn::StringAsset "<h1>Hello, world!</h1>")
                              :acl "public-read"
                              :contentType "text/html")))
   :outputs (:bucketEndpoint "http://${my-bucket.websiteEndpoint}")))

;;; pulumi.el ends here
