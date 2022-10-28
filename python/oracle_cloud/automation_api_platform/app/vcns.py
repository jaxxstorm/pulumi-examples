from flask import (
    current_app,
    Blueprint,
    render_template,
    request,
    flash,
    redirect,
    url_for,
    render_template,
)
import pulumi_oci as oci
import requests
import pulumi.automation as auto
import pulumi

bp = Blueprint("vcns", __name__, url_prefix="/vcns")

def create_pulumi_program(cidr_block: str):
    # Create a bucket and expose a website index document
    vcn = oci.core.Vcn(
        "platform",
        cidr_block=cidr_block,
        compartment_id="ocid1.tenancy.oc1..aaaaaaaavh67gfytloujvijdue6pqwhfrlo2ms4jbkpozyez7sgdhf27e4yq"
    )
    
    pulumi.export("vcn_id", vcn.id)
    
@bp.route("/new", methods=["GET", "POST"])
def create_vcn():
    """creates new vcn"""
    if request.method == "POST":
        stack_name = request.form.get("vcn-id")
        cidr_block = request.form.get("cidr-block")

        def pulumi_program():
            return create_pulumi_program(str(cidr_block))

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
                f"Error: VCN with name '{stack_name}' already exists, pick a unique name",
                category="danger",
            )

        return redirect(url_for("vcns.list_vcns"))

    return render_template("vcns/create.html")


@bp.route("/", methods=["GET"])
def list_vcns():
    """lists all vcns"""
    vcns = []
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
            vcns.append(
                {
                    "name": stack.name,
                    "vcn_id": outs["vcn_id"].value,
                    "console_url": f"https://app.pulumi.com/{org_name}/{project_name}/{stack.name}",
                }
            )
    except Exception as exn:
        flash(str(exn), category="danger")

    return render_template("vcns/index.html", vcns=vcns)


@bp.route("/<string:id>/delete", methods=["POST"])
def delete_vcn(id: str):
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
        flash(f"VCN '{stack_name}' successfully deleted!", category="success")
    except auto.ConcurrentUpdateError:
        flash(
            f"Error: Site '{stack_name}' already has update in progress",
            category="danger",
        )
    except Exception as exn:
        flash(str(exn), category="danger")

    return redirect(url_for("vcns.list_vcns"))



