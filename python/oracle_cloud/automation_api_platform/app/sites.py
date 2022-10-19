import json
import requests
import pulumi_oci as oci
from flask import (
    current_app,
    Blueprint,
    request,
    flash,
    redirect,
    url_for,
    render_template,
)

import pulumi
import pulumi.automation as auto

bp = Blueprint("sites", __name__, url_prefix="/sites")


# This function defines our pulumi s3 static website in terms of the content that the caller passes in.
# This allows us to dynamically deploy websites based on user defined values from the POST body.
def create_pulumi_program(content: str):
    # Create a bucket and expose a website index document
    bucket = oci.objectstorage.Bucket(
        "example",
        access_type="public"
    )
    

@bp.route("/new", methods=["GET", "POST"])
def create_site():
    """creates new sites"""
    if request.method == "POST":
        stack_name = request.form.get("site-id")
        file_url = request.form.get("file-url")
        if file_url:
            site_content = requests.get(file_url).text
        else:
            site_content = request.form.get("site-content")

        def pulumi_program():
            return create_pulumi_program(str(site_content))

        try:
            # create a new stack, generating our pulumi program on the fly from the POST body
            stack = auto.create_stack(
                stack_name=str(stack_name),
                project_name=current_app.config["PROJECT_NAME"],
                program=pulumi_program,
            )
            # deploy the stack, tailing the logs to stdout
            stack.up(on_output=print)
            flash(f"Successfully created site '{stack_name}'", category="success")
        except auto.StackAlreadyExistsError:
            flash(
                f"Error: Site with name '{stack_name}' already exists, pick a unique name",
                category="danger",
            )

        return redirect(url_for("sites.list_sites"))

    return render_template("sites/create.html")


@bp.route("/", methods=["GET"])
def list_sites():
    """lists all sites"""
    sites = []
    org_name = current_app.config["PULUMI_ORG"]
    project_name = current_app.config["PROJECT_NAME"]
    try:
        ws = auto.LocalWorkspace(
            project_settings=auto.ProjectSettings(name=project_name, runtime="python")
        )
        all_stacks = ws.list_stacks()
        for stack in all_stacks:
            stack = auto.select_stack(
                stack_name=stack.name,
                project_name=project_name,
                # no-op program, just to get outputs
                program=lambda: None,
            )
            outs = stack.outputs()
            sites.append(
                {
                    "name": stack.name,
                    "url": f"http://{outs['website_url'].value}",
                    "console_url": f"https://app.pulumi.com/{org_name}/{project_name}/{stack.name}",
                }
            )
    except Exception as exn:
        flash(str(exn), category="danger")

    return render_template("sites/index.html", sites=sites)


@bp.route("/<string:id>/update", methods=["GET", "POST"])
def update_site(id: str):
    stack_name = id

    if request.method == "POST":
        file_url = request.form.get("file-url")
        if file_url:
            site_content = requests.get(file_url).text
        else:
            site_content = str(request.form.get("site-content"))

        try:

            def pulumi_program():
                create_pulumi_program(str(site_content))

            stack = auto.select_stack(
                stack_name=stack_name,
                project_name=current_app.config["PROJECT_NAME"],
                program=pulumi_program,
            )
            # deploy the stack, tailing the logs to stdout
            stack.up(on_output=print)
            flash(f"Site '{stack_name}' successfully updated!", category="success")
        except auto.ConcurrentUpdateError:
            flash(
                f"Error: site '{stack_name}' already has an update in progress",
                category="danger",
            )
        except Exception as exn:
            flash(str(exn), category="danger")
        return redirect(url_for("sites.list_sites"))

    stack = auto.select_stack(
        stack_name=stack_name,
        project_name=current_app.config["PROJECT_NAME"],
        # noop just to get the outputs
        program=lambda: None,
    )
    outs = stack.outputs()
    content_output = outs.get("website_content")
    content = content_output.value if content_output else None
    return render_template("sites/update.html", name=stack_name, content=content)


@bp.route("/<string:id>/delete", methods=["POST"])
def delete_site(id: str):
    stack_name = id
    try:
        stack = auto.select_stack(
            stack_name=stack_name,
            project_name=current_app.config["PROJECT_NAME"],
            # noop program for destroy
            program=lambda: None,
        )
        stack.destroy(on_output=print)
        stack.workspace.remove_stack(stack_name)
        flash(f"Site '{stack_name}' successfully deleted!", category="success")
    except auto.ConcurrentUpdateError:
        flash(
            f"Error: Site '{stack_name}' already has update in progress",
            category="danger",
        )
    except Exception as exn:
        flash(str(exn), category="danger")

    return redirect(url_for("sites.list_sites"))
